var midiFileParser = require('midi-file-parser'),
	midi = require('midi'),
	fs = require('fs'),
	output = new midi.output(),
	currentSong,
	on = false, // TO DO - store this within each track, and global start/stops can be applied to all tracks with a forEach, then individual tracks can be muted (may need global on in js_seq.js, and do on/off functions rather than toggle)
	tempo = 120,
	tempoOverride = false,
	ticksPerBeat = 384, // TO DO - what about other time signatures, e.g. 6/8??
	beatsPerBar = 4, // TO DO - set this from MIDI file ***********************************************************************************
	subBeats = 12,
	locationMarkers = {}, // only uses first value for each key at the moment, but values stored as arrays for future implementation
	newLocation = 0; //
	
// setup output port
output.openVirtualPort('js_seq');

var nextCommand = function(beatInfo) {

	if (beatInfo.subBeat === 1) {
		if (beatInfo.beat === 1) {
			process.stdout.write('\n');
		}
		process.stdout.write(beatInfo.beat + ' ');
	}
	
	if (on) {
		currentSong.tracks.forEach(function(track, trackIndex) {
			track.forEach(function(command) {
				if (command.beatInfo.bar === beatInfo.bar && command.beatInfo.beat === beatInfo.beat && command.beatInfo.subBeat === beatInfo.subBeat) {
					processCommand(command, trackIndex);
				}
			});
		});
		setTimeout(function(beatInfo) {
			
			// if end of bar check if we need to skip to a new position
			if (newLocation !== 0 && beatInfo.beat === beatsPerBar && beatInfo.subBeat === subBeats) {
				beatInfo.bar = newLocation;
				beatInfo.beat = 1;
				beatInfo.subBeat = 1;
				newLocation = 0;
			} else { // otherwise just move to next subBeat
				beatInfo = addSubBeat(beatInfo);
			}

			nextCommand(beatInfo);

		}, parseInt(60000 / tempo / subBeats), beatInfo);
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
		if (tempo !== (60000000 / command.microsecondsPerBeat)) {
			tempo = 60000000 / command.microsecondsPerBeat;
			console.log('\nTempo changed to ' + tempo + ' bpm');
		}
	} else if (command.subtype === 'noteOn' || command.subtype === 'noteOff') {
		output.sendMessage([144 + track, command.noteNumber, command.velocity]);
	}
};

var addSubBeat = function(beatInfo) {
	if (beatInfo.subBeat === subBeats) {
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
	return beatInfo;
};

module.exports = {
	
	load: function(path) {

		// reset to default values
		on = false;
		tempoOverride = false;
		locationMarkers = {};
		
		// load file
		try {
			var file = fs.readFileSync(path, 'binary');
		} catch(err) {
			console.log('file not found');
			return false;
		}
		currentSong = midiFileParser(file);
		
		// load in control data
		var controlTrack = currentSong.tracks.pop();
		var cumulativeTime = 0;
		controlTrack.forEach(function(command, index) {
			cumulativeTime += command.deltaTime;
			if (command.subtype === 'noteOn' && command.velocity > 0) {
				var noteKeyMap = ['c', 'v', 'd', 'r', 'e', 'f', 't', 'g', 'y', 'a', 'w', 'b']
				if (command.noteNumber < noteKeyMap.length) {
					var bar = Math.floor( cumulativeTime / (ticksPerBeat * beatsPerBar) );
					if (locationMarkers[noteKeyMap[command.noteNumber]]) {
						locationMarkers[noteKeyMap[command.noteNumber]].push(bar);
					} else {
						locationMarkers[noteKeyMap[command.noteNumber]] = [bar];
					}
				}
			}
		});

		// parse currentSong to put in absolute time references - this is primarily to get latestTime for the next loop
		var latestTime = 0;
		currentSong.tracks.forEach(function(track, index) {
			var absoluteTime = 0;
			track.forEach(function(command, index) {
				absoluteTime += command.deltaTime;
				command.absoluteTime = absoluteTime;
			});
			if (absoluteTime > latestTime) {
				latestTime = absoluteTime;
			}
		});
		
		// parse currentSong putting in bar/beat/subBeat info
		var subBeatVariance = (ticksPerBeat / subBeats) / 2;
		currentSong.tracks.forEach(function(track, index) {
			var beatInfo = {bar: 1, beat: 1, subBeat: 1};
			for (indexTime = 0; indexTime <= latestTime; indexTime += (ticksPerBeat / subBeats)) {
				track.forEach(function(command, index) {
					if (command.absoluteTime <= (indexTime + subBeatVariance) && command.absoluteTime > (indexTime - subBeatVariance)) {
						command.beatInfo = JSON.parse(JSON.stringify(beatInfo));
					}				
				});
				beatInfo = addSubBeat(beatInfo);
			}
		});

		console.log('song "' + path + '" loaded');
		if (locationMarkers) {
			console.log('Marker locations:');
			console.log(locationMarkers);
		}

	},
	
	togglePlay: function() {
		on = !on;
		if (on) {
			console.log('\nPlaying...');
			nextCommand({bar: 1, beat: 1, subBeat: 1});
		}
	},
	
	setTempo: function(newTempo) {
		tempo = newTempo;
		tempoOverride = true;
		
		// if not already playing, start, but after leaving a beat's length
		if (!on) {
			setTimeout(function(callback) {
				callback();
			}, parseInt(60000 / tempo), this.togglePlay);
		}

		console.log('\nTempo changed to ' + tempo + ' bpm');
	},
	
	jumpTo: function(key) {
		if (locationMarkers[key]) {
			console.log('\nJumping to bar ' + locationMarkers[key][0]);
			
			if (on) {
				newLocation = locationMarkers[key][0];
			} else {
				on = true;
				console.log('\nPlaying...');
				nextCommand({bar: locationMarkers[key][0], beat: 1, subBeat: 1});
			}
		}
	},
	
	toggleTrack: function(track) {
		// TO BE FINISHED
	}

};
