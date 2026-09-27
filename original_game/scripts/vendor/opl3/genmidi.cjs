// Vendored from wad-genmidi 0.1.0 (MIT). Patched: no dataview-getstring dependency.
function getString(dv, offset, length) {
  var out = ""
  for (var i = offset; i < dv.byteLength && (length === undefined || i < offset + length); i++) {
    var c = dv.getUint8(i)
    if (length === undefined && c === 0) break
    out += String.fromCharCode(c)
  }
  return out
}

function VoiceData(data) {
  this.modulatorTremolo = data.getUint8(0)
  this.modulatorAttack = data.getUint8(1)
  this.modulatorSustain = data.getUint8(2)
  this.modulatorWaveform = data.getUint8(3)
  this.modulatorKey = data.getUint8(4)
  this.modulatorOutput = data.getUint8(5)
  this.feedback = data.getUint8(6)
  this.carrierTremolo = data.getUint8(7)
  this.carrierAttack = data.getUint8(8)
  this.carrierSustain = data.getUint8(9)
  this.carrierWaveform = data.getUint8(10)
  this.carrierKey = data.getUint8(11)
  this.carrierOutput = data.getUint8(12)
  this.baseNoteOffset = data.getInt16(14, true)
}

function OPLInstrument(name, data) {
  this.name = name
  this.data = data
  this.flags = data.getUint16(0, true)

  this.fixedPitch = !!(this.flags & 1)
  this.unknown = !!(this.flags & 2)
  this.doubleVoice = !!(this.flags & 4)

  this.fineTuning = data.getUint8(2)
  this.fixedNote = data.getUint8(3)

  this.voices = [
    new VoiceData(new DataView(data.buffer.slice(4, 20))),
    new VoiceData(new DataView(data.buffer.slice(20, 36))),
  ]
}

function GENMIDI(lump) {
  lump = lump instanceof DataView ? lump : new DataView(lump.buffer || lump)
  this.header = getString(lump, 0, 8)
  this.instruments = []
  for (var i = 8, j = 175 * 36 + 8; i < 175 * 36 + 8; i += 36, j += 32) {
    var name = getString(lump, j)
    this.instruments.push(new OPLInstrument(name, new DataView(lump.buffer.slice(i, i + 36))))
  }
  this.lump = lump
}

module.exports = GENMIDI
