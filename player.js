var midiFileParser = require('midi-file-parser'),
	midi = require('midi'),
	fs = require('fs'),
	output = new midi.output(),
	currentSong,
	on = false,
	tempo = 60,
	tempoOverride = false;
	ticksPerBeat = 384;
	
// setup output port
output.openVirtualPort('js_seq');

var nextCommand = function(track, position) {
	if (on) {
		if (currentSong.tracks[track].length > position) {
			var command = currentSong.tracks[track][position];
			
			if (command.deltaTime && command.deltaTime > 0) {
				var time = parseInt((60000 / tempo / ticksPerBeat) * command.deltaTime);
				setTimeout(function(track, position, command) {
					processCommand(command, track);
					nextCommand(track, position + 1);
				}, time, track, position, command);
			} else {
				processCommand(command, track);
				nextCommand(track, position + 1);
			}
		}
	} else {
		for (var pitch = 0; pitch < 128; pitch++) {
			processCommand({subtype: 'noteOff', noteNumber: pitch, velocity: 0}, track);
		}
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
		console.log('song "' + path + '" loaded');
	},
	
	togglePlay: function() {
		on = !on;
		if (on) {
			console.log('\nPlaying...');
			currentSong.tracks.forEach(function(track, index) {
				nextCommand(index, 0);
			});
		}
	},
	
	setTempo: function(newTempo) {
		tempo = newTempo;
		tempoOverride = true;
		if (!on) {
			this.togglePlay();
		}
		console.log('\nTempo changed to ' + tempo + ' bpm');
	}

};

//process.stdout.write(' *' + char);
