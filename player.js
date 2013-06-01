var midiFileParser = require('midi-file-parser'),
	midi = require('midi'),
	fs = require('fs'),
	output = new midi.output(),
	currentSong,
	on = false,
	tempo = 120,
	tempoOverride = false;
	ticksPerUnit = 384 / 12, // 32
	beatsPerBar = 4; // TO DO - set this from MIDI file ****************
	
// setup output port
output.openVirtualPort('js_seq');

var nextCommand = function(position, beatInfo) {
	if (beatInfo.subBeat === 1) {
		if (beatInfo.beat === 1) {
			process.stdout.write('\n');
		}
		process.stdout.write(beatInfo.beat + ' ');
	}
	
	if (on) {
		currentSong.tracks.forEach(function(track, trackIndex) {
			track.forEach(function(command) {
				if (command.cumulativeTime >= position - (ticksPerUnit / 2) && command.cumulativeTime < position + (ticksPerUnit / 2)) {
					processCommand(command, trackIndex);
				}
			});
		});
		setTimeout(function(position, beatInfo) {
			
			if (beatInfo.subBeat === 12) {
				beatInfo.subBeat = 1;
				if (beatInfo.beat === beatsPerBar) {
					beatInfo.bar++;
					beatInfo.beat = 1;
				} else {
					beatInfo.beat++;
				}
			} else {
				beatInfo.subBeat++;
			}
			
			nextCommand(position + ticksPerUnit, beatInfo);
		}, parseInt(60000 / tempo / 12), position, beatInfo);
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
			nextCommand(0, {bar: 1, beat: 1, subBeat: 1});
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
