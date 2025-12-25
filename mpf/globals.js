export const globals = {
  term: null,
  keyMap: null,
  keypressed: false,
  startAudioSession: null,
  stopAudioSession: null,
};

export function setGlobal(name, value) {
  globals[name] = value;
}
