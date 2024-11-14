$(function() {
  // Button will be disabled until we type anything inside the input field
  const source = document.getElementById('autoComplete');
  const inputHandler = function(e) {
    if(e.target.value==""){
      $('.movie-button').attr('disabled', true);
    }
    else{
      $('.movie-button').attr('disabled', false);
    }
  }
  source.addEventListener('input', inputHandler);

  $('.movie-button').on('click',function(){
    var my_api_key = process.env.REACT_APP_OMDB_API_KEY; // Replace with your OMDB API key
    var title = $('.movie').val();
    if (title=="") {
      $('.results').css('display','none');
      $('.fail').css('display','block');
    }
    else{
      load_details(my_api_key,title);
    }
  });
});

// will be invoked when clicking on the recommended movies
function recommendcard(e){
  var my_api_key = process.env.REACT_APP_OMDB_API_KEY; // Replace with your OMDB API key
  var title = e.getAttribute('title'); 
  load_details(my_api_key,title);
}

// get the basic details of the movie from the API (based on the name of the movie)
function load_details(my_api_key,title){
  $.ajax({
    type: 'GET',
    url:`https://www.omdbapi.com/?apikey=${my_api_key}&t=${title}`,
    success: function(movie){
      if(movie.Response === "False"){
        $('.fail').css('display','block');
        $('.results').css('display','none');
        $("#loader").delay(500).fadeOut();
      }
      else{
        $("#loader").fadeIn();
        $('.fail').css('display','none');
        $('.results').delay(1000).css('display','block');
        var movie_id = movie.imdbID;
        var movie_title = movie.Title;
        movie_recs(movie_title,movie_id,my_api_key);
      }
    },
    error: function(){
      alert('Invalid Request');
      $("#loader").delay(500).fadeOut();
    },
  });
}

// passing the movie name to get the similar movies from python's flask
function movie_recs(movie_title,movie_id,my_api_key){
  $.ajax({
    type:'POST',
    url:"/similarity",
    data:{'name':movie_title},
    success: function(recs){
      if(recs=="Sorry! The movie you requested is not in our database. Please check the spelling or try with some other movies"){
        $('.fail').css('display','block');
        $('.results').css('display','none');
        $("#loader").delay(500).fadeOut();
      }
      else {
        $('.fail').css('display','none');
        $('.results').css('display','block');
        var movie_arr = recs.split('---');
        var arr = [];
        for(const movie in movie_arr){
          arr.push(movie_arr[movie]);
        }
        get_movie_details(movie_id,my_api_key,arr,movie_title);
      }
    },
    error: function(){
      alert("error recs");
      $("#loader").delay(500).fadeOut();
    },
  }); 
}

// get all the details of the movie using the movie id.
function get_movie_details(movie_id,my_api_key,arr,movie_title) {
  $.ajax({
    type:'GET',
    url:`https://www.omdbapi.com/?apikey=${my_api_key}&i=${movie_id}`,
    success: function(movie_details){
      show_details(movie_details,arr,movie_title,my_api_key,movie_id);
    },
    error: function(){
      alert("API Error!");
      $("#loader").delay(500).fadeOut();
    },
  });
}

// passing all the details to python's flask for displaying and scraping the movie reviews using imdb id
function show_details(movie_details,arr,movie_title,my_api_key,movie_id){
  var imdb_id = movie_details.imdbID;
  var poster = movie_details.Poster;
  var overview = movie_details.Plot;
  var genres = movie_details.Genre;
  var rating = movie_details.imdbRating;
  var vote_count = movie_details.imdbVotes;
  var release_date = new Date(movie_details.Released);
  var runtime = movie_details.Runtime;
  var status = 'Released';
  var genre_list = genres.split(", ");
  var my_genre = genre_list.join(", ");

  // Get recommended movie posters
  get_movie_posters(arr, my_api_key)
    .then(arr_poster => {
      movie_cast = get_movie_cast(movie_id,my_api_key);
      
      ind_cast = get_individual_cast(movie_cast,my_api_key);
      
      details = {
        'title':movie_title,
        'cast_ids':JSON.stringify(movie_cast.cast_ids),
        'cast_names':JSON.stringify(movie_cast.cast_names),
        'cast_chars':JSON.stringify(movie_cast.cast_chars),
        'cast_profiles':JSON.stringify(movie_cast.cast_profiles),
        'cast_bdays':JSON.stringify(ind_cast.cast_bdays),
        'cast_bios':JSON.stringify(ind_cast.cast_bios),
        'cast_places':JSON.stringify(ind_cast.cast_places),
        'imdb_id':imdb_id,
        'poster':poster,
        'genres':my_genre,
        'overview':overview,
        'rating':rating,
        'vote_count':vote_count.toLocaleString(),
        'release_date':release_date.toDateString().split(' ').slice(1).join(' '),
        'runtime':runtime,
        'status':status,
        'rec_movies':JSON.stringify(arr),
        'rec_posters':JSON.stringify(arr_poster),
      }

      $.ajax({
        type:'POST',
        data:details,
        url:"/recommend",
        dataType: 'html',
        complete: function(){
          $("#loader").delay(500).fadeOut();
        },
        success: function(response) {
          $('.results').html(response);
          $('#autoComplete').val('');
          $(window).scrollTop(0);
        }
      });
    });
}

// get the details of individual cast
function get_individual_cast(movie_cast,my_api_key) {
    cast_bdays = [];
    cast_bios = [];
    cast_places = [];
    for(var cast_id in movie_cast.cast_ids){
      $.ajax({
        type:'GET',
        url:`https://www.omdbapi.com/?apikey=${my_api_key}&i=${movie_cast.cast_ids[cast_id]}`,
        async:false,
        success: function(cast_details){
          cast_bdays.push((new Date(cast_details.Born)).toDateString().split(' ').slice(1).join(' '));
          cast_bios.push(cast_details.Mini_Bio);
          cast_places.push(cast_details.Born);
        }
      });
    }
    return {cast_bdays:cast_bdays,cast_bios:cast_bios,cast_places:cast_places};
  }

// getting the details of the cast for the requested movie
function get_movie_cast(movie_id, my_api_key) {
  cast_ids = [];
  cast_names = [];
  cast_chars = [];
  cast_profiles = [];

  $.ajax({
      type: 'GET',
      url: `https://www.omdbapi.com/?apikey=${my_api_key}&i=${movie_id}&plot=full`,
      async: false,
      success: function(my_movie) {
          if (my_movie.Actors) {
              // Split the actors string into array
              let actors = my_movie.Actors.split(', ');
              let characters = [];
              
              // If we have specific character information (not always available in OMDB)
              if (my_movie.Characters) {
                  characters = my_movie.Characters.split(', ');
              }

              // Limit to maximum 10 actors
              const numActors = Math.min(actors.length, 10);

              for (let i = 0; i < numActors; i++) {
                  cast_ids.push(i); // OMDB doesn't provide actor IDs, using index instead
                  cast_names.push(actors[i]);
                  cast_chars.push(characters[i] || 'Actor'); // Default to 'Actor' if character info not available
                  // Using a default profile image since OMDB doesn't provide actor images
                  cast_profiles.push('https://via.placeholder.com/200x300?text=No+Image');
              }
          }
      },
      error: function() {
          alert("Invalid Request!");
          $("#loader").delay(500).fadeOut();
      }
  });

  return {
      cast_ids: cast_ids,
      cast_names: cast_names,
      cast_chars: cast_chars,
      cast_profiles: cast_profiles
  };
}

// getting posters for all the recommended movies
function get_movie_posters(arr, my_api_key) {
  return new Promise(async (resolve) => {
      var arr_poster_list = [];
      for (var m in arr) {
          try {
              const response = await $.ajax({
                  type: 'GET',
                  url: `https://www.omdbapi.com/?apikey=${my_api_key}&t=${arr[m]}`,
              });
              
              if (response.Response === "True" && response.Poster && response.Poster !== "N/A") {
                  arr_poster_list.push(response.Poster);
              } else {
                  // Push a placeholder image if no poster is available
                  arr_poster_list.push('https://via.placeholder.com/300x450?text=No+Poster');
              }
          } catch (error) {
              console.error("Error fetching poster:", error);
              arr_poster_list.push('https://via.placeholder.com/300x450?text=Error');
          }
      }
      resolve(arr_poster_list);
  });
}