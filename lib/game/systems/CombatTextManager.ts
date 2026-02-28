import { Camera } from './Camera'

export interface DamageText {
    x: number
    y: number
    text: string
    color: string
    strokeColor: string
    lifetime: number
    age: number
    vx: number
    vy: number
    scale: number
}

export class CombatTextManager {
    private texts: DamageText[] = []

    public add(x: number, y: number, text: string, type: 'normal' | 'critical' | 'player_hit' | 'heal') {
        const isCrit = type === 'critical'

        let scale = isCrit ? 4 : 2
        let lifetime = isCrit ? 1.0 : 0.8
        let color = '#ffffff'
        let strokeColor = '#000000'

        if (type === 'player_hit') {
            color = '#961a1aff'
            strokeColor = '#ffffff' // 플레이어 피격은 하얀색 윤곽선으로 확실히 돋보이게 처리
        }
        else if (type === 'critical') {
            color = '#ffcc00d5'
            strokeColor = '#ffffff'
        }
        else if (type === 'heal') {
            color = '#33ff33'
            strokeColor = '#003300'
        }

        // 대각선 위쪽으로 퍼지는 속도
        const vx = (Math.random() - 0.5) * 80
        const vy = -(60 + Math.random() * 40)

        this.texts.push({
            x, y, text, color, strokeColor,
            lifetime, age: 0,
            vx, vy, scale
        })
    }

    public update(dt: number) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i]
            t.age += dt
            t.x += t.vx * dt
            t.y += t.vy * dt

            // 중력 효과로 위로 솟구쳤다가 살짝 느려지는 효과
            t.vy += 40 * dt

            if (t.age >= t.lifetime) {
                this.texts.splice(i, 1)
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D, camera: Camera) {
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        for (const t of this.texts) {
            const screenPos = camera.worldToScreen(t.x, t.y)
            const progress = t.age / t.lifetime

            // Fade out
            const alpha = Math.max(0, 1 - Math.pow(progress, 2)) // 나중에 빨리 사라지게

            // Size mapping (Pop-up effect)
            let currentScale = t.scale
            if (progress < 0.15) {
                currentScale *= (0.5 + (progress / 0.15) * 0.7) // 0.5 -> 1.2
            } else {
                currentScale *= (1.2 - ((progress - 0.15) / 0.85) * 0.2) // 1.2 -> 1.0
            }

            ctx.globalAlpha = alpha
            ctx.font = `bold ${Math.max(12, 16 * currentScale)}px 'Arial Black', Impact, sans-serif`

            // 타격감을 위한 텍스트 디자인 (기울임 효과 반영을 위한 행렬 변환)
            ctx.save()
            // Y축을 약간 위로, 그리고 비스듬하게 (Slanted)
            const yOffset = -30 - (progress * 30) // 위로 떠오름
            ctx.translate(screenPos.x, screenPos.y + yOffset)
            if (t.color !== '#33ff33') { // 회복이 아니면 기울임
                ctx.transform(1, -0.1, 0, 1, 0, 0)
            }

            // Text shadow for impact
            ctx.shadowColor = t.strokeColor === '#ffffff' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'
            ctx.shadowBlur = t.strokeColor === '#ffffff' ? 6 : 4
            ctx.shadowOffsetX = 2
            ctx.shadowOffsetY = 2

            // 테두리 두껍게
            ctx.lineWidth = t.strokeColor === '#ffffff' ? 4 : 3
            ctx.strokeStyle = t.strokeColor
            ctx.strokeText(t.text, 0, 0)

            // 내부 채우기
            ctx.fillStyle = t.color
            ctx.fillText(t.text, 0, 0)

            ctx.restore()
        }

        ctx.restore()
    }
}
