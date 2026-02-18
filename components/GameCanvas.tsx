'use client'

import { useEffect, useRef, useState } from 'react'
import { GameEngine } from '@/lib/game/core/GameEngine'
import styles from './GameCanvas.module.css'
import { t, setLanguage } from '@/lib/game/config/Locale'

type GameState = 'lang_select' | 'loading' | 'ready' | 'playing' | 'paused' | 'gameover'

/**
 * 게임 캔버스 컴포넌트
 */
export default function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const gameEngineRef = useRef<GameEngine | null>(null)

    const [gameState, setGameState] = useState<GameState>('lang_select')
    const [loadingProgress, setLoadingProgress] = useState(0)

    // Language Selection Handler
    const handleLanguageSelect = (lang: 'ko' | 'en') => {
        setLanguage(lang)
        setGameState('loading')
    }

    /**
     * 컴포넌트 마운트 시 게임 초기화 시퀀스 시작
     */
    useEffect(() => {
        if (gameState === 'lang_select') return

        console.log('🎬 [SEQUENCE START] GameCanvas mounted, starting initialization...')

        if (!canvasRef.current) return

        const canvas = canvasRef.current

        // Canvas 크기 설정
        const resizeCanvas = () => {
            if (!canvas.parentElement) return

            canvas.width = canvas.parentElement.clientWidth
            canvas.height = canvas.parentElement.clientHeight

            if (gameEngineRef.current) {
                gameEngineRef.current.resize(canvas.width, canvas.height)
            }
        }

        resizeCanvas()
        window.addEventListener('resize', resizeCanvas)

        // 게임 초기화 시퀀스 실행
        const initializeGameSequence = async (canvas: HTMLCanvasElement) => {
            try {
                // ========== STEP 1: GameEngine 생성 ==========
                console.log('🎮 [SEQUENCE] Creating GameEngine instance...')
                const gameEngine = new GameEngine(canvas)
                gameEngineRef.current = gameEngine

                // ========== STEP 2: 리소스 로딩 ==========
                console.log('📦 [SEQUENCE] Starting resource loading...')

                // Fallback for progress
                setLoadingProgress(10)

                // 로딩 진행률 모니터링 (ResourceLoader event)
                // Note: resourceLoader properties should be public or have getter
                if (gameEngine.resourceLoader) {
                    // Check if onProgress exists (it might be private in ResourceLoader, assuming it was added)
                    // If not, we just await.
                }

                // 리소스 로드 시작
                await gameEngine.loadResources()
                setLoadingProgress(100)

                console.log('✅ [SEQUENCE] Resources loaded, transitioning to READY state')
                setGameState('ready')

            } catch (error) {
                console.error('❌ [SEQUENCE ERROR] Failed to initialize game:', error)
            }
        }

        initializeGameSequence(canvas)

        // ESC 키로 일시정지
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.code === 'Escape') {
                if (gameState === 'playing') {
                    gameEngineRef.current?.pause()
                    setGameState('paused')
                } else if (gameState === 'paused') {
                    gameEngineRef.current?.resume()
                    setGameState('playing')
                }
            }
        }

        window.addEventListener('keydown', handleEscKey)

        // Cleanup
        return () => {
            console.log('🧹 Cleaning up GameCanvas...')
            window.removeEventListener('resize', resizeCanvas)
            window.removeEventListener('keydown', handleEscKey)
            gameEngineRef.current?.destroy()
        }
    }, [gameState === 'lang_select']) // Only re-run if lang_select changes to loading

    /**
     * STEP 3: 게임 시작 (사용자가 버튼 클릭 시)
     */
    const startGame = () => {
        console.log('🚀 [SEQUENCE] User clicked START, launching game loop...')

        if (gameEngineRef.current) {
            gameEngineRef.current.start()
            setGameState('playing')
            console.log('✅ [SEQUENCE COMPLETE] Game is now running!')
        }
    }

    /**
     * 게임 재개
     */
    const resumeGame = () => {
        if (gameEngineRef.current) {
            gameEngineRef.current.resume()
            setGameState('playing')
        }
    }

    return (
        <div className={styles.gameWrapper}>
            {/* 언어 선택 화면 */}
            {gameState === 'lang_select' && (
                <div className={styles.loadingScreen}>
                    <div className={styles.loadingContent}>
                        <h1>Select Language / 언어 선택</h1>
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '30px' }}>
                            <button
                                onClick={() => handleLanguageSelect('en')}
                                className={styles.btnStart}
                                style={{ padding: '15px 30px' }}
                            >
                                English
                            </button>
                            <button
                                onClick={() => handleLanguageSelect('ko')}
                                className={styles.btnStart}
                                style={{ padding: '15px 30px' }}
                            >
                                한국어
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 로딩 화면 */}
            {gameState === 'loading' && (
                <div className={styles.loadingScreen}>
                    <div className={styles.loadingContent}>
                        <h1>{t('game.loading')}</h1>
                        <div className={styles.loadingBar}>
                            <div
                                className={styles.loadingProgress}
                                style={{ width: `${loadingProgress}%` }}
                            />
                        </div>
                        <p>{loadingProgress.toFixed(0)}%</p>
                    </div>
                </div>
            )}

            {/* 시작 버튼 (로딩 완료 후) */}
            {gameState === 'ready' && (
                <div className={styles.startScreen}>
                    <div className={styles.startContent}>
                        <h1>🧟 Zombie MMORPG</h1>
                        <p className={styles.subtitle}>Open World ARPG</p>
                        <button onClick={startGame} className={styles.btnStart}>
                            {t('game.start')}
                        </button>
                    </div>
                </div>
            )}

            {/* 일시정지 화면 */}
            {gameState === 'paused' && (
                <div className={styles.pauseScreen}>
                    <div className={styles.pauseContent}>
                        <h2>{t('game.paused')}</h2>
                        <button onClick={resumeGame} className={styles.btnResume}>
                            {t('game.resume')}
                        </button>
                    </div>
                </div>
            )}

            {/* 게임 Canvas */}
            <canvas
                ref={canvasRef}
                className={`${styles.gameCanvas} ${gameState === 'paused' ? styles.blur : ''}`}
            />
        </div>
    )
}
