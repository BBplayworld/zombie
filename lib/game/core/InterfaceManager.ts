import { Player } from '../entities/player/Player';
import { ResourceLoader } from "../systems/ResourceLoader";

/**
 * 게임 하단 인터페이스 관리자
 *
 * HP바와 인벤토리 아이콘을 zone 맵 이미지 하단에 배치.
 *
 * 렌더 순서 (z-order):
 *   [1] hp.png → globalAlpha 0.85 배경 이미지 (z 하위)
 *   [2] 내부 어두운 fill
 *   [3] HP 게이지 fill (roundRect 곡선 + glow 그림자) ← 항상 이미지보다 앞
 *   [4] 수치 텍스트
 */
export class InterfaceManager {
    private canvas: HTMLCanvasElement;

    private static readonly HP_FRAME = {
        w: 300,
        h: 25,
        /** 맵 하단에서 위쪽 여백 (px) */
        marginBottom: 28,
        /** 맵 중앙에서 왼쪽 오프셋 (HP바 오른쪽 끝 기준) */
        offsetLeft: 60,
    };

    private static readonly SKILL_ICONS = {
        size: 52,
        gap: 8,
        /** 맵 중앙에서 오른쪽 오프셋 (첫 번째 아이콘 왼쪽 끝 기준) */
        offsetRight: 20,
        /** 맵 하단에서 위쪽 여백 (px) */
        marginBottom: 14,
    };

    /** 스킬 아이콘 히트 영역 (필요에 따라 툴팁이나 클릭 처리 유지) */
    public skillIconRects: Record<string, { x: number; y: number; w: number; h: number }> = {};

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    /**
     * 마우스 위치 기반 커서 변경
     * @returns true 이면 아이콘 위에 있음
     */
    handleHover(mouseX: number, mouseY: number): boolean {
        let over = false;
        for (const key in this.skillIconRects) {
            const r = this.skillIconRects[key];
            if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
                over = true;
                break;
            }
        }
        this.canvas.style.cursor = over ? "pointer" : "default";
        return over;
    }

    /**
     * 하단 HUD 전체 렌더링
     * @param mapRect 맵 이미지의 스크린 좌표. null이면 캔버스 전체 기준 사용.
     */
    render(
        ctx: CanvasRenderingContext2D,
        player: Player,
        resourceLoader: ResourceLoader,
        mapRect?: { x: number; y: number; w: number; h: number }
    ): void {
        this.renderHPBar(ctx, player, resourceLoader, mapRect);
        this.renderSkillIcons(ctx, player, resourceLoader, mapRect);
    }

    // ─────────────────────────────────────────────────────
    //  HP 바
    // ─────────────────────────────────────────────────────

    private renderHPBar(
        ctx: CanvasRenderingContext2D,
        player: Player,
        resourceLoader: ResourceLoader,
        mapRect?: { x: number; y: number; w: number; h: number }
    ): void {
        const cfg = InterfaceManager.HP_FRAME;

        // 맵 영역 가져오기 (fallback: 캔버스 전체)
        const area = mapRect ?? { x: 0, y: 0, w: this.canvas.getBoundingClientRect().width, h: this.canvas.getBoundingClientRect().height };
        const mapCenterX = area.x + area.w / 2;
        const mapBottom = area.y + area.h;

        // HP바를 맵 하단 중앙에서 약간 왼쪽에 배치 (바의 오른쪽 끝이 중앙에서 offsetLeft만큼 왼쪽)
        const barW = cfg.w;
        const barH = cfg.h;
        const barX = mapCenterX - cfg.offsetLeft - barW;
        const barY = mapBottom - cfg.marginBottom - barH;

        // 맵 영역을 벗어나지 않도록 클램프
        const clampedBarX = Math.max(area.x + 4, Math.min(barX, area.x + area.w - barW - 4));
        const clampedBarY = Math.max(area.y + 4, barY);

        const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
        const fillW = Math.round(barW * hpRatio);

        ctx.save();

        // ── [1] 배경 프레임 ────────────
        const hpFrameImg = resourceLoader.getImage("hpBar");
        if (hpFrameImg?.complete && (hpFrameImg.naturalWidth ?? 0) > 0) {
            ctx.globalAlpha = 0.92;
            ctx.drawImage(hpFrameImg, clampedBarX, clampedBarY, barW, barH);
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = "rgba(20, 8, 8, 0.88)";
            ctx.beginPath();
            ctx.roundRect(clampedBarX, clampedBarY, barW, barH, 4);
            ctx.fill();
        }

        // ── [2] HP 게이지 fill ─────────
        if (fillW > 0) {
            const grad = ctx.createLinearGradient(clampedBarX, 0, clampedBarX + Math.min(80, fillW), 0);
            grad.addColorStop(0, "#c80000");
            grad.addColorStop(1, "#8b0000");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(clampedBarX, clampedBarY, fillW, barH, 4);
            ctx.fill();
        }

        ctx.restore();

        // ── [3] 수치 텍스트 ───────────────────────────────
        this.renderHPText(ctx, player, clampedBarX, clampedBarY - 20, barW, hpRatio);
    }

    /**
     * HP 텍스트: "현재 / 최대"
     */
    private renderHPText(
        ctx: CanvasRenderingContext2D,
        player: Player,
        barX: number,
        baseY: number,
        barW: number,
        hpRatio: number,
    ): void {
        const cx = barX + barW / 2;

        const hpColor =
            hpRatio > 0.6 ? "#f0c0c0" : hpRatio > 0.3 ? "#ff8844" : "#ff3333";

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.font = "bold 13px monospace";
        ctx.fillStyle = hpColor;
        ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, cx, baseY);

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────
    //  스킬 아이콘
    // ─────────────────────────────────────────────────────

    private renderSkillIcons(
        ctx: CanvasRenderingContext2D,
        player: Player,
        resourceLoader: ResourceLoader,
        mapRect?: { x: number; y: number; w: number; h: number }
    ): void {
        const cfg = InterfaceManager.SKILL_ICONS;
        const size = cfg.size;
        const gap = cfg.gap;

        // 맵 영역 가져오기 (fallback: 캔버스 전체)
        const area = mapRect ?? { x: 0, y: 0, w: this.canvas.getBoundingClientRect().width, h: this.canvas.getBoundingClientRect().height };
        const mapCenterX = area.x + area.w / 2;
        const mapBottom = area.y + area.h;

        // 스킬 아이콘 세트를 맵 하단 중앙에서 약간 오른쪽에 배치
        const startX = mapCenterX + cfg.offsetRight;
        const startY = mapBottom - cfg.marginBottom - size;

        const clampedY = Math.max(area.y + 4, startY);

        const keys = ["q", "w", "e", "r"] as const;

        keys.forEach((key, index) => {
            const x = startX + (size + gap) * index;
            // 맵 영역을 벗어나지 않도록 클램프
            const clampedX = Math.min(x, area.x + area.w - size - 4);

            this.skillIconRects[key] = { x: clampedX, y: clampedY, w: size, h: size };

            ctx.save();
            ctx.translate(clampedX, clampedY);

            // 1) 기본 배경
            ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
            ctx.beginPath();
            ctx.roundRect(0, 0, size, size, 8);
            ctx.fill();

            // 2) 스킬 이미지
            // 미리 정의된 "skillIcon_{key}" 리소스를 사용
            const skillImg = resourceLoader.getImage(`skillIcon_${key}`);
            if (skillImg && skillImg.complete && skillImg.naturalWidth > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(0, 0, size, size, 8);
                ctx.clip(); // 둥근 테두리 클리핑
                ctx.drawImage(skillImg, 0, 0, size, size);
                ctx.restore();
            } else {
                ctx.fillStyle = "#888";
                ctx.font = "bold 20px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(key.toUpperCase(), size / 2, size / 2);
            }

            // 3) 외곽선 
            ctx.strokeStyle = "rgba(100, 100, 100, 0.8)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(0, 0, size, size, 8);
            ctx.stroke();

            // 4) 쿨타임 오버레이 & 텍스트
            const sm = player.skillManager;
            if (sm) {
                const currentCd = sm.getCooldown(key);
                const maxCd = sm.skills[key]?.cooldown || 0;

                if (currentCd > 0 && maxCd > 0) {
                    const ratio = currentCd / maxCd; // 1.0 (시작) -> 0.0 (끝)

                    // 반투명 회색 배경 (시계방향 투명도 효과)
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(0, 0, size, size, 8);
                    ctx.clip();

                    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                    ctx.beginPath();
                    ctx.moveTo(size / 2, size / 2);
                    // -Math.PI / 2 (12시 방향)을 시작으로 남은 비율만큼 역방향(반시계)으로 아크를 그리면, 
                    // 빈 공간이 시계방향으로 돌아가며 진행되는 효과가 납니다.
                    ctx.arc(size / 2, size / 2, size * 1.5, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * ratio, true);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();

                    // 남은 시간 텍스트
                    ctx.fillStyle = "white";
                    ctx.font = "bold 16px monospace";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.shadowColor = "black";
                    ctx.shadowBlur = 4;
                    // 남은 시간을 소수점 첫째자리까지 표시 (1보다 작을 경우만, 아니면 정수표시)
                    const timeText = currentCd < 1.0 ? currentCd.toFixed(1) : Math.ceil(currentCd).toString();
                    ctx.fillText(timeText, size / 2, size / 2 + 2);
                    ctx.shadowBlur = 0;
                }
            }

            // 5) 하단 단축키 텍스트
            ctx.font = "11px monospace";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
            ctx.fillText(`[${key.toUpperCase()}]`, size / 2, size - 2);

            ctx.restore();
        });
    }
}
