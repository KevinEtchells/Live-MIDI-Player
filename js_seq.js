var player = require('./player'),
	songs = [],
	currentSongIndex = 0,
	tapTempoTimes = [];

console.log('js_seq started');

// load songs into array
for (var i = 2; i < process.argv.length; i++) {
	songs.push(process.argv[i]);
}
if (songs.length) {
	player.load(songs[currentSongIndex]);
} else {
	console.log('no songs loaded, exiting...');
	process.exit();
}

// define inputs
process.stdin.resume();
process.stdin.setRawMode(true);
process.stdin.on('data', function (char) {
	if (char == ' ') {
		player.togglePlay();
	} else if (char == ',') {
		
		//get current time
		var currentTime = new Date().getTime();
		
		// check any previously stored times are recent
		if (tapTempoTimes.length) {
			if (tapTempoTimes[tapTempoTimes.length - 1] >= (currentTime - 2500)) {
				tapTempoTimes.push(currentTime);
				
				// if we have 4 times change the tempo
				if (tapTempoTimes.length === 4) {
					player.setTempo(parseInt(60000 / ((tapTempoTimes[3] - tapTempoTimes[0]) / 3)));
					tapTempoTimes = [];
				}
				
			} else {
				tapTempoTimes = [currentTime];
			}
		} else {
			tapTempoTimes.push(currentTime);
		}
		
	} else if (char == '1') {
		player.load(songs[0]);
	} else if (char == '2') {
		if (songs.length >= 2) {
			player.load(songs[1]);
		}
	} else if (char == '3') {
		if (songs.length >= 3) {
			player.load(songs[2]);
		}
	} else if (char == '4') {
		if (songs.length >= 4) {
			player.load(songs[3]);
		}
	} else if (char == '5') {
		if (songs.length >= 5) {
			player.load(songs[4]);
		}
	} else if (char == '6') {
		if (songs.length >= 6) {
			player.load(songs[5]);
		}
	} else if (char == '7') {
		if (songs.length >= 7) {
			player.load(songs[6]);
		}
	} else if (char == '8') {
		if (songs.length >= 8) {
			player.load(songs[7]);
		}
	} else if (char == '9') {
		if (songs.length >= 9) {
			player.load(songs[8]);
		}
	} else if (char == '\3') { 
		console.log('\nExiting...'); 
		process.exit(); 
	} 
});
