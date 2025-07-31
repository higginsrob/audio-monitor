class AudioMonitor {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.analyser = null;
        this.dataArray = null;
        this.isMonitoring = false;
        this.outputDevice = null;
        this.gainNode = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadDevices();
    }

    initializeElements() {
        this.elements = {
            inputSelect: document.getElementById('inputSelect'),
            outputSelect: document.getElementById('outputSelect'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            inputMeter: document.getElementById('inputMeter'),
            outputMeter: document.getElementById('outputMeter'),
            inputDbLevel: document.getElementById('inputDbLevel'),
            outputDbLevel: document.getElementById('outputDbLevel'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText')
        };
    }

    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startMonitoring());
        this.elements.stopBtn.addEventListener('click', () => this.stopMonitoring());
        
        this.elements.volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.elements.volumeValue.textContent = `${value}%`;
            if (this.gainNode) {
                this.gainNode.gain.value = value / 100;
            }
        });

        this.elements.inputSelect.addEventListener('change', () => {
            if (this.isMonitoring) {
                this.stopMonitoring();
            }
            if (this.elements.inputSelect.value) {
                this.startMonitoring();
            }
        });

        this.elements.outputSelect.addEventListener('change', () => {
            this.updateOutputDevice();
        });
    }

    async loadDevices() {
        try {
            // Request permissions first
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.populateDeviceSelectors(devices);
        } catch (error) {
            console.error('Error loading devices:', error);
            this.updateStatus('Error loading devices', false);
        }
    }

    populateDeviceSelectors(devices) {
        const inputDevices = devices.filter(device => device.kind === 'audioinput');
        const outputDevices = devices.filter(device => device.kind === 'audiooutput');

        // Clear existing options
        this.elements.inputSelect.innerHTML = '<option value="">Select Input Device...</option>';
        this.elements.outputSelect.innerHTML = '';

        // Add input devices
        inputDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${device.deviceId.substr(0, 8)}...`;
            this.elements.inputSelect.appendChild(option);
        });

        // Add output devices
        outputDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Speaker ${device.deviceId.substr(0, 8)}...`;
            this.elements.outputSelect.appendChild(option);
        });

        this.updateStatus('Devices loaded', true);
    }

    async startMonitoring() {
        const selectedInputId = this.elements.inputSelect.value;
        if (!selectedInputId) {
            alert('Please select an input device first.');
            return;
        }

        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Get user media with selected device
            const constraints = {
                audio: {
                    deviceId: selectedInputId ? { exact: selectedInputId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Create audio nodes
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.gainNode = this.audioContext.createGain();
            
            // Configure analyser
            this.analyser.fftSize = 1024;
            this.analyser.smoothingTimeConstant = 0.3;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            // Set initial gain
            this.gainNode.gain.value = this.elements.volumeSlider.value / 100;
            
            // Connect nodes
            source.connect(this.analyser);
            this.analyser.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
            
            // Update UI
            this.isMonitoring = true;
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
            this.updateStatus('Monitoring active', true);
            
            // Start animation loop
            this.animateMeters();
            
        } catch (error) {
            console.error('Error starting monitoring:', error);
            this.updateStatus('Error starting monitoring', false);
            alert('Error starting monitoring: ' + error.message);
        }
    }

    stopMonitoring() {
        this.isMonitoring = false;
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.analyser = null;
        this.gainNode = null;
        this.dataArray = null;
        
        // Reset meters
        this.elements.inputMeter.style.width = '0%';
        this.elements.outputMeter.style.width = '0%';
        this.elements.inputDbLevel.textContent = '-∞ dB';
        this.elements.outputDbLevel.textContent = '-∞ dB';
        
        // Update UI
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.updateStatus('Monitoring stopped', false);
    }

    animateMeters() {
        if (!this.isMonitoring || !this.analyser) return;
        
        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate RMS (Root Mean Square) for more accurate volume representation
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i] * this.dataArray[i];
        }
        const rms = Math.sqrt(sum / this.dataArray.length);
        
        // Convert to decibels
        const db = rms > 0 ? 20 * Math.log10(rms / 255) : -Infinity;
        
        // Update input meter
        this.updateMeter(this.elements.inputMeter, this.elements.inputDbLevel, db);
        
        // For output, we'll use the same value adjusted by gain
        const gainValue = this.gainNode ? this.gainNode.gain.value : 1;
        const outputDb = db + (20 * Math.log10(gainValue));
        this.updateMeter(this.elements.outputMeter, this.elements.outputDbLevel, outputDb);
        
        // Continue animation
        requestAnimationFrame(() => this.animateMeters());
    }

    updateMeter(meterElement, dbElement, db) {
        // Convert dB to percentage (assuming -60dB to 0dB range)
        const minDb = -45;
        const maxDb = 0;
        const percentage = Math.max(0, Math.min(100, ((db - minDb) / (maxDb - minDb)) * 100));
        
        meterElement.style.width = `${percentage}%`;
        
        // Update dB display
        if (db === -Infinity) {
            dbElement.textContent = '-∞ dB';
        } else {
            dbElement.textContent = `${db.toFixed(1)} dB`;
        }
        
        // Add visual effects for high levels
        if (db > -10) {
            meterElement.classList.add('active');
        } else {
            meterElement.classList.remove('active');
        }
    }

    async updateOutputDevice() {
        const selectedOutputId = this.elements.outputSelect.value;
        if (!selectedOutputId) return;

        try {
            // Note: Changing output device dynamically is limited in web browsers
            if (this.audioContext && this.audioContext.setSinkId) {
                await this.audioContext.setSinkId(selectedOutputId);
            }
        } catch (error) {
            console.error('Error changing output device:', error);
        }
    }

    updateStatus(message, isConnected) {
        this.elements.statusText.textContent = message;
        if (isConnected) {
            this.elements.statusDot.classList.add('connected');
        } else {
            this.elements.statusDot.classList.remove('connected');
        }
    }
}

// Initialize the audio monitor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AudioMonitor();
});

// Handle page visibility changes to manage resources
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.audioMonitor && window.audioMonitor.isMonitoring) {
        // Optionally pause monitoring when page is hidden
        console.log('Page hidden - monitoring continues');
    }
});
