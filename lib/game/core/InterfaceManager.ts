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
        /** 인벤토리 상단 여백 보장 */
        marginBottom: 80,
    };

    private static readonly INVENTORY_ICON = {
        size: 52,
        /** 맵 중앙에서 오른쪽 오프셋 (스킬들과 시작 위치 동일) */
        offsetRight: 20,
        /** HP바와 같은 라인에 위치하도록 설정 */
        marginBottom: 28,
    };

    /** 스킬, 인벤토리 아이콘 히트 영역 (필요에 따라 툴팁이나 클릭 처리 유지) */
    public iconRects: Record<string, { x: number; y: number; w: number; h: number }> = {};

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    /**
     * 마우스 위치 기반 커서 변경
     * @returns true 이면 아이콘 위에 있음
     */
    handleHover(mouseX: number, mouseY: number): boolean {
        let over = false;
        for (const key in this.iconRects) {
            const r = this.iconRects[key];
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
        this.renderLevelBar(ctx, player, mapRect);        // ← 레벨 바 추가
        this.renderInventoryIcon(ctx, player, resourceLoader, mapRect);
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
        const hpFrameImg = resourceLoader.getImage("interface_hpBar");
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
        this.renderHPText(ctx, player, clampedBarX, clampedBarY, barW, barH, fillW, hpRatio);
    }

    /**
     * HP 텍스트: HP fill 오른쪽 끝 안쪽에 표시
     */
    private renderHPText(
        ctx: CanvasRenderingContext2D,
        player: Player,
        barX: number,
        barY: number,
        barW: number,
        barH: number,
        fillW: number,
        hpRatio: number,
    ): void {
        const hpColor =
            hpRatio > 0.6 ? '#fff' : hpRatio > 0.3 ? '#ffcc88' : '#ff6666';

        const text = `${Math.ceil(player.hp)} / ${player.maxHp}`;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = hpColor;

        // fill 오른쪽 끝 안쪽 4px에 오른쪽 정렬
        if (fillW > 30) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, barX + fillW - 4, barY + barH / 2);
        } else {
            // HP가 너무 적으면 바 오른쪽 바깥에 표시
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, barX + fillW + 4, barY + barH / 2);
        }

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────
    //  레벨 & 경험치 바
    // ─────────────────────────────────────────────────────

    /**
     * 레벨 원형 배지 + 경험치 게이지 (HP바 바로 위에 배치)
     * - 레벨업 중에는 골드 펄스 글로우 적용
     */
    private renderLevelBar(
        ctx: CanvasRenderingContext2D,
        player: Player,
        mapRect?: { x: number; y: number; w: number; h: number }
    ): void {
        const hpCfg = InterfaceManager.HP_FRAME;
        const area = mapRect ?? { x: 0, y: 0, w: this.canvas.getBoundingClientRect().width, h: this.canvas.getBoundingClientRect().height };
        const mapCenterX = area.x + area.w / 2;
        const mapBottom = area.y + area.h;

        const barW = hpCfg.w;
        const barH = hpCfg.h;
        const barX = mapCenterX - hpCfg.offsetLeft - barW;
        const barY = mapBottom - hpCfg.marginBottom - barH;
        const clampedBarX = Math.max(area.x + 4, Math.min(barX, area.x + area.w - barW - 4));
        const clampedBarY = Math.max(area.y + 4, barY);

        const lvSys = player.levelSystem;
        const level = lvSys.level;
        const expPct = lvSys.expProgress;
        const isLevelingUp = player.levelUpTimer > 0;

        // 경험치 바 (HP바 보다 6px 위)
        const expBarH = 5;
        const expBarY = clampedBarY - 10;
        const expFillW = Math.round(barW * expPct);

        ctx.save();

        // ── 경험치 바 배경 ──
        ctx.fillStyle = 'rgba(20, 20, 40, 0.85)';
        ctx.fillRect(clampedBarX, expBarY, barW, expBarH);

        // ── 경험치 게이지 ──
        if (expFillW > 0) {
            const expGrad = ctx.createLinearGradient(clampedBarX, 0, clampedBarX + expFillW, 0);
            if (isLevelingUp) {
                const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 150);
                expGrad.addColorStop(0, `rgba(255,200,0,${pulse})`);
                expGrad.addColorStop(1, `rgba(255,150,0,${pulse})`);
                ctx.shadowColor = 'rgba(255,200,0,0.9)';
                ctx.shadowBlur = 12;
            } else {
                expGrad.addColorStop(0, '#5b8cff');
                expGrad.addColorStop(1, '#8b5fff');
            }
            ctx.fillStyle = expGrad;
            ctx.fillRect(clampedBarX, expBarY, expFillW, expBarH);
            ctx.shadowBlur = 0;
        }

        // ── 레벨 원형 배지 ──
        const badgeR = 14;
        const badgeX = clampedBarX - badgeR - 6;
        const badgeY = expBarY + expBarH / 2;

        if (isLevelingUp) {
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 16;
        }

        // 배지 배경
        const badgeGrad = ctx.createRadialGradient(badgeX, badgeY, 0, badgeX, badgeY, badgeR);
        badgeGrad.addColorStop(0, isLevelingUp ? '#ffe066' : '#3a4a8a');
        badgeGrad.addColorStop(1, isLevelingUp ? '#ff9900' : '#1a2050');
        ctx.fillStyle = badgeGrad;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isLevelingUp ? '#ffd700' : 'rgba(100,120,200,0.8)';
        ctx.lineWidth = isLevelingUp ? 2.5 : 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 레벨 숫자
        ctx.fillStyle = isLevelingUp ? '#1a1a00' : '#e0e8ff';
        ctx.font = `bold ${level >= 10 ? 11 : 13}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(level), badgeX, badgeY);

        // ── 경험치 현재/필요 수치 텍스트 ──
        if (level < 30) {
            const curExp = lvSys.currentExp;
            const reqExp = lvSys.requiredExp;
            ctx.fillStyle = 'rgba(180,190,240,0.95)';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${curExp} / ${reqExp} EXP`, clampedBarX + barW, expBarY - 2);
        } else {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('MAX LEVEL', clampedBarX + barW, expBarY - 2);
        }

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
        const startY = mapBottom - cfg.marginBottom - size - 5;

        const clampedY = Math.max(area.y + 4, startY);

        const keys = ["q", "w", "e", "r"] as const;

        keys.forEach((key, index) => {
            const x = startX + (size + gap) * index;
            // 맵 영역을 벗어나지 않도록 클램프
            const clampedX = Math.min(x, area.x + area.w - size - 4);

            this.iconRects[key] = { x: clampedX, y: clampedY, w: size, h: size };

            ctx.save();
            ctx.translate(clampedX, clampedY);

            // 1) 기본 배경
            ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
            ctx.beginPath();
            ctx.roundRect(0, 0, size, size, 8);
            ctx.fill();

            // 2) 스킬 이미지
            // 미리 정의된 "skillIcon_{key}" 리소스를 사용
            const skillImg = resourceLoader.getImage(`interface_skill_${key}`);
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
            ctx.strokeStyle = "rgba(63, 62, 62, 0.8)";
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
            ctx.font = "bold 11px monospace";
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
            ctx.fillText(`[${key.toUpperCase()}]`, size / 2, size - 2);

            ctx.restore();
        });
    }

    // ─────────────────────────────────────────────────────
    //  인벤토리 아이콘
    // ─────────────────────────────────────────────────────

    private renderInventoryIcon(
        ctx: CanvasRenderingContext2D,
        player: Player,
        resourceLoader: ResourceLoader,
        mapRect?: { x: number; y: number; w: number; h: number }
    ): void {
        const cfg = InterfaceManager.INVENTORY_ICON;
        const size = cfg.size;

        const area = mapRect ?? { x: 0, y: 0, w: this.canvas.getBoundingClientRect().width, h: this.canvas.getBoundingClientRect().height };
        const mapCenterX = area.x + area.w / 2;
        const mapBottom = area.y + area.h;

        const startX = mapCenterX + cfg.offsetRight;
        const startY = mapBottom - cfg.marginBottom - size;

        const clampedY = Math.max(area.y + 4, startY);
        const clampedX = Math.min(startX, area.x + area.w - size - 4);

        // inventory key for rects
        this.iconRects['inventory'] = { x: clampedX, y: clampedY, w: size, h: size };

        ctx.save();
        ctx.translate(clampedX, clampedY);

        // 기본 배경
        ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, 8);
        ctx.fill();

        const invImg = resourceLoader.getImage('interface_inventoryIcon');
        if (invImg && invImg.complete && invImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, size, size, 8);
            ctx.clip(); // 둥근 테두리 클리핑
            ctx.drawImage(invImg, 0, 0, size, size);
            ctx.restore();
        } else {
            ctx.fillStyle = "#888";
            ctx.font = "bold 20px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("INV", size / 2, size / 2);
        }

        // 인벤토리가 열려있으면 외곽선 강조
        if (player.isInventoryOpen) {
            ctx.strokeStyle = "rgba(255, 200, 50, 0.9)";
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = "rgba(100, 100, 100, 0.8)";
            ctx.lineWidth = 2;
        }
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, 8);
        ctx.stroke();

        // 하단 단축키 텍스트
        ctx.font = "11px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.fillText(`[I]`, size / 2, size - 2);

        ctx.restore();
    }
}
