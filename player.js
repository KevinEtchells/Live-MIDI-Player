var midiFileParser = require('midi-file-parser'),
	midi = require('midi'),
	fs = require('fs'),
	output = new midi.output(),
	currentSong,
	on = false,
	tempo = 120,
	tempoOverride = false;
	ticksPerUnit = 384 / 12; // 32
	
// setup output port
output.openVirtualPort('js_seq');

var nextCommand = function(position) {
	//process.stdout.write(' *' + char);
	if (on) {
		currentSong.tracks.forEach(function(track, trackIndex) {
			track.forEach(function(command) {
				if (command.cumulativeTime >= position - (ticksPerUnit / 2) && command.cumulativeTime < position + (ticksPerUnit / 2)) {
					processCommand(command, trackIndex);
				}
			});
		});
		setTimeout(function(nextPosition) {
			nextCommand(nextPosition);
		}, parseInt(60000 / tempo / 12), position + ticksPerUnit);
	} else {
		currentSong.tracks.forEach(function(track, trackIndex) {
			for (var pitch = 0; pitch < 128; pitch++) {
				processCommand({subtype: 'noteOff', noteNumber: pitch, velocity: 0}, trackIndex);
			}
		});
		console.log('\nStopped...');
	}
};

var processCommand = function(command, track) {
	if (command.subtype === 'setTempo' && !tempoOverride) {
		tempo = 60000000 / command.microsecondsPerBeat;
		console.log('\nTempo changed to ' + tempo + ' bpm');
	} else if (command.subtype === 'noteOn' || command.subtype === 'noteOff') {
		output.sendMessage([144 + track, command.noteNumber, command.velocity]);
	}
};

module.exports = {
	
	load: function(path) {
		on = false;
		tempoOverride = false;
		try {
			var file = fs.readFileSync(path, 'binary');
		} catch(err) {
			console.log('file not found');
			return false;
		}
		currentSong = midiFileParser(file);
		
		// parse currentSong to put in absolute time references
		currentSong.tracks.forEach(function(track, index) {
			var cumulativeTime = 0;
			track.forEach(function(command, index) {
				cumulativeTime += command.deltaTime;
				command.cumulativeTime = cumulativeTime;
			});
		});

		console.log('song "' + path + '" loaded');
	},
	
	togglePlay: function() {
		on = !on;
		if (on) {
			console.log('\nPlaying...');
			nextCommand(0);
		}
	},
	
	setTempo: function(newTempo) {
		tempo = newTempo;
		tempoOverride = true;
		
		// if not already playing, start, but after leaving a beat's length
		if (!on) {
			setTimeout(function(callback) {
				callback();
			}, parseInt(60000 / tempo / 12), this.togglePlay);
		}

		console.log('\nTempo changed to ' + tempo + ' bpm');
	}

};
