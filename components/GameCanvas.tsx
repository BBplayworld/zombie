'use client'

import { useEffect, useRef, useState } from 'react'
import { GameEngine } from '@/lib/game/core/GameEngine'
import styles from './GameCanvas.module.css'

type GameState = 'loading' | 'ready' | 'playing' | 'paused' | 'gameover'

/**
 * 게임 캔버스 컴포넌트
 * 
 * 게임 초기화 시퀀스:
 * 1. 컴포넌트 마운트 (useEffect)
 * 2. Canvas 크기 설정
 * 3. GameEngine 생성 (STEP 1: constructor)
 * 4. 리소스 로딩 시작 (STEP 2: loadResources)
 * 5. 로딩 완료 후 'ready' 상태로 전환
 * 6. 사용자가 "게임 시작" 버튼 클릭
 * 7. 게임 루프 시작 (STEP 3: start)
 */
export default function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const gameEngineRef = useRef<GameEngine | null>(null)

    const [gameState, setGameState] = useState<GameState>('loading')
    const [loadingProgress, setLoadingProgress] = useState(0)

    /**
     * 컴포넌트 마운트 시 게임 초기화 시퀀스 시작
     */
    useEffect(() => {
        console.log('🎬 [SEQUENCE START] GameCanvas mounted, starting initialization...')

        if (!canvasRef.current) return

        const canvas = canvasRef.current

        // Canvas 크기 설정
        const resizeCanvas = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight

            if (gameEngineRef.current) {
                gameEngineRef.current.resize(window.innerWidth, window.innerHeight)
            }
        }

        resizeCanvas()
        window.addEventListener('resize', resizeCanvas)

        // 게임 초기화 시퀀스 실행
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
    }, []) // gameState를 의존성에서 제거하고 ref 사용

    /**
     * 게임 초기화 시퀀스
     * STEP 1 → STEP 2 → (사용자 대기) → STEP 3
     */
    const initializeGameSequence = async (canvas: HTMLCanvasElement) => {
        try {
            // ========== STEP 1: GameEngine 생성 ==========
            console.log('🎮 [SEQUENCE] Creating GameEngine instance...')
            const gameEngine = new GameEngine(canvas)
            gameEngineRef.current = gameEngine

            // ========== STEP 2: 리소스 로딩 ==========
            console.log('📦 [SEQUENCE] Starting resource loading...')

            // 로딩 진행률 모니터링
            gameEngine.resourceLoader.onProgress((progress: number) => {
                setLoadingProgress(progress)
                console.log(`📊 Loading progress: ${progress.toFixed(0)}%`)
            })

            // 로딩 완료 콜백
            gameEngine.resourceLoader.onComplete(() => {
                console.log('✅ [SEQUENCE] Resources loaded, transitioning to READY state')
                setGameState('ready')
            })

            // 리소스 로드 시작
            await gameEngine.loadResources()

            console.log('⏸️  [SEQUENCE] Waiting for user to click "Start Game" button...')

            // ========== STEP 3: start() 호출은 startGame() 함수에서 실행 ==========

        } catch (error) {
            console.error('❌ [SEQUENCE ERROR] Failed to initialize game:', error)
            // TODO: 에러 상태 처리
        }
    }

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
            {/* 로딩 화면 */}
            {gameState === 'loading' && (
                <div className={styles.loadingScreen}>
                    <div className={styles.loadingContent}>
                        <h1>🧟 Zombie MMORPG</h1>
                        <div className={styles.loadingBar}>
                            <div
                                className={styles.loadingProgress}
                                style={{ width: `${loadingProgress}%` }}
                            />
                        </div>
                        <p>{loadingProgress.toFixed(0)}% 로딩 중...</p>
                    </div>
                </div>
            )}

            {/* 시작 버튼 (로딩 완료 후) */}
            {gameState === 'ready' && (
                <div className={styles.startScreen}>
                    <div className={styles.startContent}>
                        <h1>🧟 Zombie MMORPG</h1>
                        <p className={styles.subtitle}>오픈 월드 쿼터뷰 액션 게임</p>
                        <button onClick={startGame} className={styles.btnStart}>
                            게임 시작
                        </button>
                    </div>
                </div>
            )}

            {/* 일시정지 화면 */}
            {gameState === 'paused' && (
                <div className={styles.pauseScreen}>
                    <div className={styles.pauseContent}>
                        <h2>일시정지</h2>
                        <button onClick={resumeGame} className={styles.btnResume}>
                            계속하기
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
