'use client'

import { useEffect, useRef, useState } from 'react'
import { GameEngine } from '@/lib/game/core/GameEngine'
import styles from './GameCanvas.module.css'
import { t, setLanguage } from '@/lib/game/config/Locale'

type GameState = 'lang_select' | 'loading' | 'ready' | 'playing' | 'paused' | 'gameover'

const ASSET_LABELS: Record<string, string> = {
    mapBackground: '월드 맵',
    player: '플레이어',
    fight: '전투 스프라이트',
    helmet: '아이템: 투구',
    armor: '아이템: 갑옷',
    weapon: '아이템: 무기',
    window: 'UI 윈도우',
    baseTile: '기본 타일',
    backgroundTile: '배경 타일',
    mon_1: '몬스터: Walker',
    mon_2: '몬스터: Runner',
    mon_3: '몬스터: Tank',
    mon_4: '몬스터: Ghost',
    mon_5: '몬스터: Boss',
}

export default function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const gameEngineRef = useRef<GameEngine | null>(null)
    const engineInitRef = useRef(false) // 엔진 초기화 중복 방지

    const [gameState, setGameState] = useState<GameState>('lang_select')
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [loadingKey, setLoadingKey] = useState('')
    const [loadedCount, setLoadedCount] = useState(0)
    const [totalCount, setTotalCount] = useState(0)

    const handleLanguageSelect = (lang: 'ko' | 'en') => {
        setLanguage(lang)
        setGameState('loading')
    }

    /* ── 캔버스 리사이즈 + ESC 키 (마운트~언마운트 전체) ── */
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const resize = () => {
            const parent = canvas.parentElement
            if (!parent) return
            canvas.width = parent.clientWidth
            canvas.height = parent.clientHeight
            gameEngineRef.current?.resize(canvas.width, canvas.height)
        }
        resize()
        window.addEventListener('resize', resize)

        const onKey = (e: KeyboardEvent) => {
            if (e.code !== 'Escape') return
            const eng = gameEngineRef.current
            if (!eng) return
            if (eng.state === 'playing') {
                eng.pause()
                setGameState('paused')
            } else if (eng.state === 'paused') {
                eng.resume()
                setGameState('playing')
            }
        }
        window.addEventListener('keydown', onKey)

        return () => {
            window.removeEventListener('resize', resize)
            window.removeEventListener('keydown', onKey)
        }
    }, []) // 마운트 1회만

    /* ── 게임 엔진 초기화 (lang_select → loading 전환 시 1회) ── */
    useEffect(() => {
        if (gameState !== 'loading') return
        if (engineInitRef.current) return // 이미 초기화 중이면 스킵
        engineInitRef.current = true

        const canvas = canvasRef.current
        if (!canvas) return

        // 이 시점에 캔버스 크기 재설정
        const parent = canvas.parentElement
        if (parent) {
            canvas.width = parent.clientWidth
            canvas.height = parent.clientHeight
        }

        const init = async () => {
            try {
                const engine = new GameEngine(canvas)
                gameEngineRef.current = engine

                engine.resourceLoader.onProgress((progress, key) => {
                    setLoadingProgress(progress)
                    setLoadingKey(key)
                    setLoadedCount(engine.resourceLoader.getLoadedCount())
                    setTotalCount(engine.resourceLoader.getTotalCount())
                })

                setLoadingProgress(5)
                await engine.loadResources()
                setLoadingProgress(100)
                setGameState('ready')
            } catch (e) {
                console.error('Game init failed:', e)
                engineInitRef.current = false // 실패 시 재시도 가능
            }
        }
        init()

        // ※ 이 useEffect cleanup 에서 engine.destroy()를 호출하지 않음
        //    → loading→ready 전환 시 리소스 이미지가 사라지는 버그 방지
    }, [gameState])

    /* ── 컴포넌트 언마운트 시에만 엔진 정리 ── */
    useEffect(() => {
        return () => {
            gameEngineRef.current?.destroy()
        }
    }, [])

    const startGame = () => {
        gameEngineRef.current?.start()
        setGameState('playing')
    }

    const resumeGame = () => {
        gameEngineRef.current?.resume()
        setGameState('playing')
    }

    const isPreGame = ['lang_select', 'loading', 'ready'].includes(gameState)

    return (
        <div className={styles.gameWrapper}>

            {/* ── 게임 전 화면 (배경 이미지 공유) ── */}
            {isPreGame && (
                <div className={styles.titleScreen}>
                    <img
                        src="/assets/main/start.png"
                        alt="title background"
                        className={styles.titleBg}
                        draggable={false}
                    />
                    <div className={styles.vignetteTop} />
                    <div className={styles.bottomPanel} />

                    {/* 언어 선택 */}
                    {gameState === 'lang_select' && (
                        <div className={styles.overlay}>
                            <div className={styles.langBox}>
                                <p className={styles.langTitle}>Select Language / 언어 선택</p>
                                <div className={styles.langButtons}>
                                    <button className={styles.fantasyBtn} onClick={() => handleLanguageSelect('en')}>
                                        <span className={styles.fantasyBtnInner}>English</span>
                                    </button>
                                    <button className={styles.fantasyBtn} onClick={() => handleLanguageSelect('ko')}>
                                        <span className={styles.fantasyBtnInner}>한국어</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 리소스 로딩 */}
                    {gameState === 'loading' && (
                        <div className={styles.overlay}>
                            <div className={styles.loadBox}>
                                <p className={styles.loadTitle}>리소스 다운로드 중...</p>
                                <p className={styles.loadFile}>
                                    {ASSET_LABELS[loadingKey] ?? loadingKey}
                                    {totalCount > 0 && (
                                        <span className={styles.loadCount}>&nbsp;({loadedCount} / {totalCount})</span>
                                    )}
                                </p>
                                <div className={styles.progressWrap}>
                                    <div className={styles.progressOuter}>
                                        <div
                                            className={styles.progressFill}
                                            style={{ width: `${loadingProgress}%` }}
                                        />
                                        <div className={styles.progressGlow} style={{ left: `${loadingProgress}%` }} />
                                    </div>
                                    <span className={styles.progressPct}>{loadingProgress.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 게임 시작 버튼 */}
                    {gameState === 'ready' && (
                        <div className={styles.overlay}>
                            <div className={styles.startBox}>
                                <button className={styles.startBtn} onClick={startGame}>
                                    <span className={styles.startBtnInner}>{t('game.start')}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 일시정지 */}
            {gameState === 'paused' && (
                <div className={styles.pauseScreen}>
                    <div className={styles.pauseBox}>
                        <h2 className={styles.pauseTitle}>{t('game.paused')}</h2>
                        <button className={styles.fantasyBtn} onClick={resumeGame}>
                            <span className={styles.fantasyBtnInner}>{t('game.resume')}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* 게임 캔버스 (항상 DOM에 존재해야 함) */}
            <canvas
                ref={canvasRef}
                className={`${styles.gameCanvas} ${gameState === 'paused' ? styles.blur : ''}`}
            />
        </div>
    )
}
