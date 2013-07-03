var fs = require('fs'),
	midiFileParser = require('midi-file-parser'),
	midi = require('midi'),
	output = new midi.output(),
	currentSong = [],
	on = false,
	tempo = 120,
	tempoOverride = false,
	ticksPerBeat = 384, // TO DO - what about other time signatures, e.g. 6/8??
	beatsPerBar = 4,
	subBeats = 12,
	locationMarkers = {},
	newLocation = 0, // anything other than 0 means a position change is pending
	mutedChannels = [false, false, false, false, false, false, false, false, false, false];
	
// setup output port
output.openVirtualPort('Live-MIDI-Player');
// in case virtual port isn't supported (Windows)...
if (output.getPortCount()) {
	output.openPort(0);
}


var nextCommand = function(beatInfo) {

	if (beatInfo.subBeat === 1) {
		if (beatInfo.beat === 1) {
			process.stdout.write('\n');
		}
		process.stdout.write(beatInfo.beat + ' ');
	}
	
	if (on) {

		currentSong.forEach(function(command) {
			if (command.beatInfo.bar === beatInfo.bar && command.beatInfo.beat === beatInfo.beat && command.beatInfo.subBeat === beatInfo.subBeat) {
				processCommand(command);
			}
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
		
		for (var trackIndex = 0; trackIndex < 16; trackIndex++) {
			muteTrack(trackIndex);
		}
		console.log('\nStopped...');

	}
};

var muteTrack = function(trackIndex) {
	for (var pitch = 0; pitch < 128; pitch++) {
		processCommand({subtype: 'noteOff', noteNumber: pitch, velocity: 0, channel: trackIndex});
	}
};

var processCommand = function(command) {
	if (command.subtype === 'setTempo' && !tempoOverride) {
		if (tempo !== (60000000 / command.microsecondsPerBeat)) {
			tempo = 60000000 / command.microsecondsPerBeat;
			console.log('\nTempo changed to ' + Math.round(tempo) + ' bpm');
		}
	} else if (command.subType === 'timeSignature') {
		beatsPerBar = command.numerator;
	} else if (command.subtype === 'noteOn' || command.subtype === 'noteOff') {
		if (!mutedChannels[command.channel]) {
			output.sendMessage([144 + command.channel, command.noteNumber, command.velocity]);
		}
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
var minusSubBeat = function(beatInfo) {
	if (beatInfo.subBeat === 1) {
		beatInfo.subBeat = subBeats;
		if (beatInfo.beat === 1) {
			beatInfo.beat = beatsPerBar;
			if (beatInfo.bar !== 1) {
				beatInfo.bar--;
			}
		} else {
			beatInfo.beat--;
		}
	} else {
		beatInfo.subBeat--;
	}
	return beatInfo;
};

module.exports = {
	
	load: function(path) {

		// reset to default values
		on = false;
		tempoOverride = false;
		locationMarkers = {};
		mutedChannels = [false, false, false, false, false, false, false, false, false, false];
		currentSong = [];
		
		// load file
		try {
			var file = fs.readFileSync(path, 'binary');
		} catch(err) {
			console.log('file not found');
			return false;
		}
		var loadedSongData = midiFileParser(file);
		

		// go through tempSong, adding to currentSong and adding in absolute time references
		var latestTime = 0;
		loadedSongData.tracks.forEach(function(track) {
			
			var cumulativeTime = 0;
			track.forEach(function(command) {
				
				cumulativeTime += command.deltaTime;

				if (command.subtype === 'setTempo' || command.subtype === 'timeSignature' || command.subtype === 'noteOn' || command.subtype === 'noteOff') {
					command.absoluteTime = cumulativeTime;
					currentSong.push(command);
				} else if (command.subtype === 'marker') {
					locationMarkers[command.text[0]] = Math.floor( cumulativeTime / (ticksPerBeat * beatsPerBar) ) + 1;
				}
				
			});
			
			if (cumulativeTime > latestTime) {
				latestTime = cumulativeTime;
			}
			
		});
		
		// parse currentSong putting in bar/beat/subBeat info
		var subBeatVariance = (ticksPerBeat / subBeats) / 2;
		var beatInfo = {bar: 1, beat: 1, subBeat: 1};		
		for (indexTime = 0; indexTime <= (latestTime + subBeatVariance); indexTime += (ticksPerBeat / subBeats)) {
			
			currentSong.forEach(function(command, index) {
				
				// if it's a note-off, we want to bring this forward a subbeat to avoid the same note off and on at the same time
				if (command.subtype === 'noteOff' || command.velocity === '0') {
					if (command.absoluteTime <= (indexTime + subBeatVariance) && command.absoluteTime > (indexTime - subBeatVariance)) {
						command.beatInfo = minusSubBeat(JSON.parse(JSON.stringify(beatInfo)));
					}
				} else {
					if (command.absoluteTime <= (indexTime + subBeatVariance) && command.absoluteTime > (indexTime - subBeatVariance)) {
						if (command.subType === 'timeSignature') {
							beatsPerBar = command.numerator;
						}
						command.beatInfo = JSON.parse(JSON.stringify(beatInfo));
					}
				}
			});
			
			beatInfo = addSubBeat(beatInfo);
		}

		console.log('song "' + path + '" loaded');

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
			console.log('\nJumping to bar ' + locationMarkers[key]);
			if (on) {
				newLocation = locationMarkers[key];
			} else {
				on = true;
				console.log('\nPlaying...');
				nextCommand({bar: locationMarkers[key], beat: 1, subBeat: 1});
			}
		}
	},
	
	toggleTrack: function(track) {
		if (mutedChannels[track - 1]) {
			console.log('\nChannel ' + track + ' unmuted');
		} else {
			muteTrack(track - 1);
			console.log('\nChannel ' + track + ' muted');
		}
		mutedChannels[track - 1] = !mutedChannels[track - 1];
	}

};
