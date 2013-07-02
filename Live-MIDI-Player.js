// TO DO:
// mute by track or by MIDI channel?
// auto-connect to JACK apps


var player = require('./player.js'),
	songs = [],
	currentSongIndex = 0,
	tapTempoTimes = [];

console.log('Live MIDI Player started');

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
process.stdin.on('data', function (charObj) {

	var char = charObj.toString();
	
	if (char === ' ') {
		player.togglePlay();
	} else if (char === ',') { // tap tempo
		
		//get current time
		var currentTime = new Date().getTime();

		// check any previously stored times are recent
		if (tapTempoTimes.length) {
			
			// if there has been too much of a delay between beats - set this as the first beat
			if (tapTempoTimes[tapTempoTimes.length - 1] >= (currentTime - 2500)) {
				
				// if this has come too quickly after the last beat, cancel tap tempo
				if (tapTempoTimes[tapTempoTimes.length - 1] >= (currentTime - 250)) {
					tapTempoTimes = [];
					console.log('* tap tempo - incorrect entry *');
				} else {
					
					tapTempoTimes.push(currentTime);
					console.log('*');
				
					// if we have 4 times change the tempo
					if (tapTempoTimes.length === 4) {
						player.setTempo(parseInt(60000 / ((tapTempoTimes[3] - tapTempoTimes[0]) / 3)));
						tapTempoTimes = [];
					}
					
				}
				
			} else {
				tapTempoTimes = [currentTime];
				console.log('*');
			}
		} else {
			tapTempoTimes.push(currentTime);
			console.log('*');
		}
		
	} else if (char >= '0' && char <= '9') { // mute/unmute channels
		player.toggleTrack(char);
	} else if (char === '-') { // previous song
		if (currentSongIndex !== 0) {
			currentSongIndex --;
			player.load(songs[currentSongIndex]);
		}
	} else if (char === '=') { // next song
		if ((songs.length - 1) > currentSongIndex) {
			currentSongIndex ++;
			player.load(songs[currentSongIndex]);
		}
	} else if (char === '\3') {
		console.log('\nExiting...'); 
		process.exit(); 
	} else if (char === 'c' || char === 'v' || char === 'd' || char === 'r' || char === 'e' || char === 'f' || char === 't' || char === 'g' || char === 'y' || char === 'a' || char === 'w' || char === 'b') {
		player.jumpTo(char);
	}

});
