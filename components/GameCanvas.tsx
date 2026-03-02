'use client'

import { useEffect, useRef, useState } from 'react'
import { GameEngine } from '@/lib/game/core/GameEngine'
import styles from './GameCanvas.module.css'
import { t, setLanguage, currentLang } from '@/lib/game/config/Locale'
import { SoundManager } from '@/lib/game/systems/SoundManager'

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
    const [isTooSmall, setIsTooSmall] = useState(false)
    const [hasSave, setHasSave] = useState(false)  // 저장 데이터 존재 여부

    // BGM 오디오 상태
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isMuted, setIsMuted] = useState(true)
    const [volume, setVolume] = useState(0.1)

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume
            audioRef.current.muted = isMuted
        }
        SoundManager.getInstance().setVolume(volume)
        SoundManager.getInstance().setMuted(isMuted)
    }, [volume, isMuted])

    const handleLanguageSelect = (lang: 'ko' | 'en') => {
        setLanguage(lang)
        setSelectedLang(lang)
    }

    /* ── 보안 및 모바일 접속 차단 (마운트 시 1회) ── */
    useEffect(() => {
        // 1. 모바일 기기 및 터치 환경 차단
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800 || ('ontouchstart' in window) || navigator.maxTouchPoints > 0
        if (isMobileDevice) {
            alert("이 게임은 PC 전용입니다. 모바일 환경이나 디바이스 에뮬레이터에서는 원활한 실행이 보장되지 않습니다.")
        }

        // 터치 이벤트 차단 제어
        const blockTouch = (e: TouchEvent) => { e.preventDefault() }
        window.addEventListener('touchstart', blockTouch, { passive: false })
        window.addEventListener('touchmove', blockTouch, { passive: false })

        // 2. 우클릭(컨텍스트 메뉴) 방지
        const blockContextMenu = (e: MouseEvent) => { e.preventDefault() }
        window.addEventListener('contextmenu', blockContextMenu)

        // 3. 앱 테스트 방해를 위한 개발자 도구 단축키 방지
        const blockDevTools = (e: KeyboardEvent) => {
            if (e.key === 'F12' || e.keyCode === 123) {
                e.preventDefault()
            }
            const ctrlOrMeta = e.ctrlKey || e.metaKey
            if (ctrlOrMeta && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
                e.preventDefault()
            }
            if (ctrlOrMeta && ['U', 'u'].includes(e.key)) {
                e.preventDefault()
            }
        }
        window.addEventListener('keydown', blockDevTools)

        return () => {
            window.removeEventListener('touchstart', blockTouch)
            window.removeEventListener('touchmove', blockTouch)
            window.removeEventListener('contextmenu', blockContextMenu)
            window.removeEventListener('keydown', blockDevTools)
        }
    }, [])

    /* ── 캔버스 리사이즈 + ESC 키 (마운트~언마운트 전체) ── */
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const resize = () => {
            const innerW = window.innerWidth
            const innerH = window.innerHeight

            // 논리적 캔버스 가로 해상도: 최소 1024, 최대 2048
            const logicalWidth = Math.max(1024, Math.min(2048, innerW))
            // 논리적 세로 해상도 보정: 최소 512, 최대 1024
            const logicalHeight = Math.max(512, Math.min(1024, innerH))

            const dpr = window.devicePixelRatio || 1

            // 렌더링 해상도는 스케일과 dpr값을 반영한 논리적 크기
            canvas.width = logicalWidth * dpr
            canvas.height = logicalHeight * dpr

            // 화면에 표시될 CSS 크기는 브라우저 창 크기에 무조건 맞추되 (가장 작은 상태라도 1024x512 고정 유지)
            canvas.style.width = `${logicalWidth}px`
            canvas.style.height = `${logicalHeight}px`

            // 최소 해상도보다 작아지면 경고 상태 on 및 일시정지 처리
            const winTooSmall = innerW < 1024 || innerH < 512
            setIsTooSmall(winTooSmall)

            if (winTooSmall) {
                const eng = gameEngineRef.current
                if (eng && eng.state === 'playing') {
                    eng.pause()
                    setGameState('paused')
                }
            }

            gameEngineRef.current?.resize(logicalWidth, logicalHeight, dpr)
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

        // 이 시점에 캔버스 해상도 재설정 (물리적 해상도와 논리적 해상도 분리)
        const innerW = window.innerWidth
        const innerH = window.innerHeight

        const logicalWidth = Math.max(1024, Math.min(2048, innerW))
        const logicalHeight = Math.max(512, Math.min(1024, innerH))
        const dpr = window.devicePixelRatio || 1

        canvas.width = logicalWidth * dpr
        canvas.height = logicalHeight * dpr

        canvas.style.width = `${logicalWidth}px`
        canvas.style.height = `${logicalHeight}px`

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

                // 저장 데이터 로딩
                const loaded = await engine.loadSaveData()
                setHasSave(loaded)

                setLoadingProgress(100)
                setGameState('ready')
            } catch (e) {
                console.error('Game init failed:', e)
                engineInitRef.current = false
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

    const startGame = (newGame: boolean = false) => {
        if (newGame) {
            // 새 게임: 저장 삭제 후 시작
            fetch('/api/save', { method: 'DELETE' }).catch(() => { })
        }
        gameEngineRef.current?.start()
        setGameState('playing')
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.warn('BGM play failed:', e))
        }
    }

    const resumeGame = () => {
        gameEngineRef.current?.resume()
        setGameState('playing')
        if (audioRef.current && !isMuted) {
            audioRef.current.play().catch(e => console.warn('BGM play failed:', e))
        }
    }

    const goToTitle = () => {
        gameEngineRef.current?.pause()
        gameEngineRef.current?.resetToTitle()
        setGameState('ready')
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }
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
                                {hasSave && (
                                    <button className={styles.startBtn} onClick={() => startGame(false)} style={{ marginBottom: 10 }}>
                                        <span className={styles.startBtnInner}>📂 계속하기</span>
                                    </button>
                                )}
                                <button className={hasSave ? styles.pauseBtn : styles.startBtn} onClick={() => startGame(!hasSave ? false : true)}>
                                    <span className={hasSave ? styles.pauseBtnInner : styles.startBtnInner}>
                                        {hasSave ? '🆕 새 게임' : t('game.start')}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 일시정지 */}
            {gameState === 'paused' && !isTooSmall && (
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

            {/* 화면 작아짐 경고창 (최상위 배치) */}
            {isTooSmall && (
                <div className={styles.tooSmallScreen}>
                    <div className={styles.tooSmallBox}>
                        <h2 className={styles.tooSmallTitle}>화면 크기 경고</h2>
                        <p className={styles.tooSmallDesc}>
                            현재 브라우저 창의 크기가 원활하게 게임을 실행하기에 너무 작습니다.<br />
                            정상적인 표시를 위해 창 크기를 <b>1024x512</b> 픽셀 이상으로 늘려주세요.
                        </p>
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

            {/* BGM 제어 오디오 태그 및 UI */}
            <audio ref={audioRef} src="/assets/main/sounds/basic.mp3" loop />

            {gameState !== 'loading' && (
                <div className={styles.soundControlBox}>
                    <button
                        className={styles.soundToggleBtn}
                        onClick={() => setIsMuted(!isMuted)}
                        title={isMuted ? "Sound Off" : "Sound On"}
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                    {!isMuted && (
                        <input
                            type="range"
                            min="0" max="1" step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className={styles.volumeSlider}
                        />
                    )}
                </div>
            )}
        </div>
    )
}
