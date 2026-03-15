// ============================================
// Audio Effect Chain — Web Audio API
// All nodes start in bypass/transparent state
// ============================================

let effectChain = null;

function initEffectChain(source, analyserNode, audioCtx) {
    // Input gain
    const inputGain = audioCtx.createGain();
    inputGain.gain.value = 1.0;

    // Low-pass filter (20000 Hz = transparent)
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000;
    filter.Q.value = 1;

    // Distortion (linear curve = transparent)
    const distortion = audioCtx.createWaveShaper();
    distortion.curve = makeDistortionCurve(0);
    distortion.oversample = '4x';

    // Delay (0 = transparent)
    const delay = audioCtx.createDelay(2.0);
    delay.delayTime.value = 0;
    const delayFeedback = audioCtx.createGain();
    delayFeedback.gain.value = 0;
    const delayDry = audioCtx.createGain();
    delayDry.gain.value = 1.0;
    const delayWet = audioCtx.createGain();
    delayWet.gain.value = 0;
    const delayMerge = audioCtx.createGain();

    // Reverb (convolver with dry/wet mix)
    const convolver = audioCtx.createConvolver();
    convolver.buffer = generateReverbIR(audioCtx, 2, 2.0, false);
    const reverbDry = audioCtx.createGain();
    reverbDry.gain.value = 1.0;
    const reverbWet = audioCtx.createGain();
    reverbWet.gain.value = 0;
    const reverbMerge = audioCtx.createGain();

    // Stereo panner (0 = center)
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = 0;

    // Master volume
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;

    // Wire the chain:
    // source → inputGain → filter → distortion → delay split → reverb split → panner → master → analyser → destination
    source.connect(inputGain);
    inputGain.connect(filter);
    filter.connect(distortion);

    // Delay: dry path + wet path merged
    distortion.connect(delayDry);
    distortion.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayDry.connect(delayMerge);
    delayWet.connect(delayMerge);

    // Reverb: dry path + wet path merged
    delayMerge.connect(reverbDry);
    delayMerge.connect(convolver);
    convolver.connect(reverbWet);
    reverbDry.connect(reverbMerge);
    reverbWet.connect(reverbMerge);

    reverbMerge.connect(panner);
    panner.connect(masterGain);
    masterGain.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);

    effectChain = {
        inputGain,
        filter,
        distortion,
        delay,
        delayFeedback,
        delayDry,
        delayWet,
        delayMerge,
        convolver,
        reverbDry,
        reverbWet,
        reverbMerge,
        panner,
        masterGain,
        audioCtx,
        // Current effect values for UI display
        values: {
            volume: 1.0,
            filterFreq: 20000,
            filterType: 'lowpass',
            distortionAmount: 0,
            delayTime: 0,
            delayFeedback: 0,
            reverbWet: 0,
            pan: 0
        }
    };

    return effectChain;
}

// --- Parameter setters (called by gesture-mixer) ---

function setVolume(val) {
    if (!effectChain) return;
    val = clampEffect(val, 0, 2);
    effectChain.masterGain.gain.setTargetAtTime(val, effectChain.audioCtx.currentTime, 0.05);
    effectChain.values.volume = val;
}

function setFilterFrequency(freq) {
    if (!effectChain) return;
    freq = clampEffect(freq, 100, 20000);
    effectChain.filter.frequency.setTargetAtTime(freq, effectChain.audioCtx.currentTime, 0.05);
    effectChain.values.filterFreq = freq;
}

function setDistortion(amount) {
    if (!effectChain) return;
    amount = clampEffect(amount, 0, 100);
    effectChain.distortion.curve = makeDistortionCurve(amount);
    effectChain.values.distortionAmount = amount;
}

function setDelayParams(time, feedback) {
    if (!effectChain) return;
    time = clampEffect(time, 0, 1.0);
    feedback = clampEffect(feedback, 0, 0.8);
    const ctx = effectChain.audioCtx;
    effectChain.delay.delayTime.setTargetAtTime(time, ctx.currentTime, 0.05);
    effectChain.delayFeedback.gain.setTargetAtTime(feedback, ctx.currentTime, 0.05);
    const wet = time > 0.01 ? 0.5 : 0;
    effectChain.delayWet.gain.setTargetAtTime(wet, ctx.currentTime, 0.05);
    effectChain.delayDry.gain.setTargetAtTime(1.0, ctx.currentTime, 0.05);
    effectChain.values.delayTime = time;
    effectChain.values.delayFeedback = feedback;
}

function setReverbMix(wet) {
    if (!effectChain) return;
    wet = clampEffect(wet, 0, 1);
    const ctx = effectChain.audioCtx;
    effectChain.reverbWet.gain.setTargetAtTime(wet, ctx.currentTime, 0.05);
    effectChain.reverbDry.gain.setTargetAtTime(1 - wet * 0.5, ctx.currentTime, 0.05);
    effectChain.values.reverbWet = wet;
}

function setStereoPan(pan) {
    if (!effectChain) return;
    pan = clampEffect(pan, -1, 1);
    effectChain.panner.pan.setTargetAtTime(pan, effectChain.audioCtx.currentTime, 0.05);
    effectChain.values.pan = pan;
}

function setBassBoost(intensity) {
    if (!effectChain) return;
    intensity = clampEffect(intensity, 0, 1);
    const ctx = effectChain.audioCtx;
    effectChain.filter.type = 'lowpass';
    const freq = 800 - intensity * 400; // 800Hz down to 400Hz
    effectChain.filter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
    effectChain.filter.Q.setTargetAtTime(1 + intensity * 2, ctx.currentTime, 0.05);
    effectChain.values.filterFreq = freq;
    effectChain.values.filterType = 'lowpass';
    setReverbMix(0.3 * intensity);
    setDistortion(15 * intensity);
}

function setVocalIsolate(active) {
    if (!effectChain) return;
    const ctx = effectChain.audioCtx;
    if (active) {
        effectChain.filter.type = 'highpass';
        effectChain.filter.frequency.setTargetAtTime(300, ctx.currentTime, 0.05);
        effectChain.filter.Q.setTargetAtTime(1, ctx.currentTime, 0.05);
        effectChain.values.filterFreq = 300;
        effectChain.values.filterType = 'highpass';
    } else {
        effectChain.filter.type = 'lowpass';
        effectChain.filter.frequency.setTargetAtTime(20000, ctx.currentTime, 0.05);
        effectChain.filter.Q.setTargetAtTime(1, ctx.currentTime, 0.05);
        effectChain.values.filterFreq = 20000;
        effectChain.values.filterType = 'lowpass';
    }
}

function setBestVersion() {
    if (!effectChain) return;
    const ctx = effectChain.audioCtx;
    // Full-range, clean playback — no filters, no distortion, slight volume boost
    effectChain.filter.type = 'lowpass';
    effectChain.filter.frequency.setTargetAtTime(20000, ctx.currentTime, 0.05);
    effectChain.filter.Q.setTargetAtTime(1, ctx.currentTime, 0.05);
    effectChain.values.filterFreq = 20000;
    effectChain.values.filterType = 'lowpass';
    setDistortion(0);
    setDelayParams(0, 0);
    setReverbMix(0);
    setStereoPan(0);
    setVolume(1.2);
}

function resetAllEffects() {
    setVolume(1.0);
    setVocalIsolate(false);
    setDistortion(0);
    setDelayParams(0, 0);
    setReverbMix(0);
    setStereoPan(0);
}

function getEffectValues() {
    return effectChain ? effectChain.values : null;
}

// --- Utilities ---

function makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    if (amount === 0) {
        // Linear (transparent)
        for (let i = 0; i < samples; i++) {
            curve[i] = (i * 2) / samples - 1;
        }
    } else {
        const deg = Math.PI / 180;
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
    }
    return curve;
}

function generateReverbIR(audioCtx, channels, duration, decay) {
    const rate = audioCtx.sampleRate;
    const length = rate * duration;
    const impulse = audioCtx.createBuffer(channels, length, rate);
    for (let ch = 0; ch < channels; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
        }
    }
    return impulse;
}

function clampEffect(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
