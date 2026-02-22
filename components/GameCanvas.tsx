'use client'

import { useEffect, useRef, useState } from 'react'
import { GameEngine } from '@/lib/game/core/GameEngine'
import styles from './GameCanvas.module.css'
import { t, setLanguage, currentLang } from '@/lib/game/config/Locale'

type GameState = 'loading' | 'ready' | 'playing' | 'paused' | 'gameover'

const ASSET_LABELS: Record<string, string> = {
    mapBackground: '월드 맵',
    player: '플레이어',
    fight: '전투 스프라이트',
    helmet: '아이템: 투구',
    armor: '아이템: 갑옷',
    weapon: '아이템: 무기',
    window: 'UI 윈도우',
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

    const [gameState, setGameState] = useState<GameState>('loading')
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [loadingKey, setLoadingKey] = useState('')
    const [loadedCount, setLoadedCount] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [selectedLang, setSelectedLang] = useState<'ko' | 'en'>(currentLang)

    const handleLanguageSelect = (lang: 'ko' | 'en') => {
        setLanguage(lang)
        setSelectedLang(lang)
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

    /* ── 게임 엔진 초기화 (마운트 시 loading → 1회) ── */
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

    const goToTitle = () => {
        gameEngineRef.current?.pause()
        gameEngineRef.current?.resetToTitle()
        setGameState('ready')
    }

    const isPreGame = ['loading', 'ready'].includes(gameState)

    return (
        <div className={styles.gameWrapper}>

            {/* ── 게임 전 화면 (배경 이미지 공유) ── */}
            {isPreGame && (
                <div className={styles.titleScreen}>
                    {/* 게임 시작 이미지 1184px 가로에 맞춘 영역 + 양쪽 그림자 */}
                    <div className={styles.startImageBox}>
                        <div className={styles.titleBg}>
                            <div className={styles.vignetteTop} />
                            <img
                                src="/assets/main/start.png"
                                alt="title background"
                                draggable={false}
                            />
                            <div className={styles.bottomPanel} />
                        </div>
                        <div className={styles.vignetteLeftStart} aria-hidden />
                        <div className={styles.vignetteRightStart} aria-hidden />
                    </div>

                    {/* 1. 리소스 로딩 */}
                    {gameState === 'loading' && (
                        <div className={styles.overlay}>
                            <div className={styles.loadBox}>
                                <p className={styles.loadLine}>리소스 다운로드 중</p>
                                <p className={styles.loadLine}>
                                    {ASSET_LABELS[loadingKey] ?? loadingKey}
                                    {totalCount > 0 && (
                                        <span className={styles.loadLineCount}> · {loadedCount} / {totalCount}</span>
                                    )}
                                </p>
                                <p className={styles.loadLineThin}>
                                    {loadingProgress.toFixed(0)}%
                                    {totalCount > 0 && (
                                        <span className={styles.loadLineBar}>
                                            <span className={styles.loadLineBarFill} style={{ width: `${loadingProgress}%` }} />
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 2. 언어 선택 + 게임 시작 (동일 화면, 흰색 텍스트) */}
                    {gameState === 'ready' && (
                        <div className={styles.overlay}>
                            <div className={styles.readyBox}>
                                <div className={styles.langRow}>
                                    <button
                                        className={`${styles.langTextBtn} ${selectedLang === 'en' ? styles.langTextBtnActive : ''}`}
                                        onClick={() => handleLanguageSelect('en')}
                                    >
                                        English
                                    </button>
                                    <span className={styles.langSeparator}>|</span>
                                    <button
                                        className={`${styles.langTextBtn} ${selectedLang === 'ko' ? styles.langTextBtnActive : ''}`}
                                        onClick={() => handleLanguageSelect('ko')}
                                    >
                                        한국어
                                    </button>
                                </div>
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
                        <div className={styles.pauseButtons}>
                            <button className={styles.pauseBtn} onClick={resumeGame}>
                                <span className={styles.pauseBtnInner}>{t('game.resume')}</span>
                            </button>
                            <button className={styles.pauseBtn} onClick={goToTitle}>
                                <span className={styles.pauseBtnInner}>{t('game.backToTitle')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 게임 캔버스 (항상 DOM에 존재, 시작 전에는 숨김) */}
            <canvas
                ref={canvasRef}
                className={`${styles.gameCanvas} ${isPreGame ? styles.gameCanvasHidden : ''} ${gameState === 'paused' ? styles.blur : ''}`}
            />
            {/* 2048px 영역 양쪽 자연스러운 그림자 (캔버스 위 오버레이) */}
            <div className={styles.vignetteLeft} aria-hidden />
            <div className={styles.vignetteRight} aria-hidden />
        </div>
    )
}
