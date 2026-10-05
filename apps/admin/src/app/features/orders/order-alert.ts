const SOUND_KEY = 'admin.orders.soundAlert';

export function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSoundPreference(enabled: boolean): void {
  localStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
}

export class OrderAlert {
  private context: AudioContext | null = null;

  blocked(): boolean {
    return this.context?.state === 'suspended';
  }

  ensure(): void {
    if (this.context !== null || typeof AudioContext === 'undefined') {
      return;
    }
    this.context = new AudioContext();
  }

  async unlock(): Promise<void> {
    this.ensure();
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  play(): void {
    const context = this.context;
    if (context === null || context.state !== 'running') {
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  }
}
