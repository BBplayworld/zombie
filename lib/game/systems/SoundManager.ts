export class SoundManager {
    private static instance: SoundManager;
    private volume: number = 0.5;
    private isMuted: boolean = false;

    // 이펙트음 캐시 (다중 재생을 위해 배열로 풀 관리할 수도 있지만, 간단히 매번 Audio 객체를 생성하거나 cloneNode 사용)
    private soundPaths: Record<string, string> = {
        'player_skills_space': '/assets/main/sounds/skills/space.mp3',
        'player_skills_q': '/assets/main/sounds/skills/q.mp3'
    };

    private constructor() { }

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    public setVolume(v: number): void {
        this.volume = v;
    }

    public setMuted(muted: boolean): void {
        this.isMuted = muted;
    }

    public playFX(key: string): void {
        if (this.isMuted || this.volume === 0) return;

        const path = this.soundPaths[key];
        if (!path) return;

        const audio = new Audio(path);
        audio.volume = this.volume;
        audio.play().catch(e => console.warn(`SoundFX play failed (${key}):`, e));
    }
}
