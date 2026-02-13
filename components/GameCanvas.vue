<template>
  <div class="game-wrapper">
    <!-- 로딩 화면 -->
    <div v-if="gameState === 'loading'" class="loading-screen">
      <div class="loading-content">
        <h1>🧟 Zombie MMORPG</h1>
        <div class="loading-bar">
          <div
            class="loading-progress"
            :style="{ width: `${loadingProgress}%` }"
          ></div>
        </div>
        <p>{{ loadingProgress.toFixed(0) }}% 로딩 중...</p>
      </div>
    </div>

    <!-- 일시정지 화면 -->
    <div v-if="gameState === 'paused'" class="pause-screen">
      <div class="pause-content">
        <h2>일시정지</h2>
        <button @click="resumeGame" class="btn-resume">계속하기</button>
      </div>
    </div>

    <!-- 게임 Canvas -->
    <canvas
      ref="gameCanvas"
      class="game-canvas"
      :class="{ blur: gameState === 'paused' }"
    ></canvas>

    <!-- 시작 버튼 (로딩 완료 후) -->
    <div v-if="gameState === 'ready'" class="start-screen">
      <div class="start-content">
        <h1>🧟 Zombie MMORPG</h1>
        <p class="subtitle">오픈 월드 쿼터뷰 액션 게임</p>
        <button @click="startGame" class="btn-start">게임 시작</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { GameEngine } from "~/composables/useGameEngine"

const gameCanvas = ref<HTMLCanvasElement | null>(null)
let gameEngine: GameEngine | null = null

const gameState = ref<"loading" | "ready" | "playing" | "paused" | "gameover">(
  "loading",
)
const loadingProgress = ref(0)

onMounted(async () => {
  if (!gameCanvas.value) return

  // Canvas 크기 설정
  resizeCanvas()
  window.addEventListener("resize", resizeCanvas)

  // 게임 엔진 초기화
  gameEngine = new GameEngine(gameCanvas.value)

  // 리소스 로딩 진행률 모니터링
  gameEngine.resourceLoader.onProgress((progress: number) => {
    loadingProgress.value = progress
  })

  gameEngine.resourceLoader.onComplete(() => {
    gameState.value = "ready"
  })

  // 리소스 로드 시작
  await gameEngine.loadResources()

  // ESC 키로 일시정지
  window.addEventListener("keydown", handleEscKey)
})

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas)
  window.removeEventListener("keydown", handleEscKey)
  gameEngine?.destroy()
})

function resizeCanvas() {
  if (!gameCanvas.value) return

  gameCanvas.value.width = window.innerWidth
  gameCanvas.value.height = window.innerHeight

  if (gameEngine) {
    gameEngine.resize(window.innerWidth, window.innerHeight)
  }
}

function startGame() {
  if (gameEngine) {
    gameEngine.start()
    gameState.value = "playing"
  }
}

function resumeGame() {
  if (gameEngine) {
    gameEngine.resume()
    gameState.value = "playing"
  }
}

function handleEscKey(e: KeyboardEvent) {
  if (e.code === "Escape") {
    if (gameState.value === "playing") {
      gameEngine?.pause()
      gameState.value = "paused"
    } else if (gameState.value === "paused") {
      resumeGame()
    }
  }
}
</script>

<style scoped>
.game-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.game-canvas {
  display: block;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
  transition: filter 0.3s ease;
}

.game-canvas.blur {
  filter: blur(5px);
}

/* 로딩 화면 */
.loading-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%);
  z-index: 100;
}

.loading-content {
  text-align: center;
  color: #fff;
}

.loading-content h1 {
  font-size: 48px;
  margin-bottom: 30px;
  text-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
}

.loading-bar {
  width: 400px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  overflow: hidden;
  margin: 20px auto;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.loading-progress {
  height: 100%;
  background: linear-gradient(90deg, #ff4444 0%, #ff8844 100%);
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
}

/* 시작 화면 */
.start-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%);
  z-index: 100;
}

.start-content {
  text-align: center;
  color: #fff;
}

.start-content h1 {
  font-size: 64px;
  margin-bottom: 10px;
  text-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
  animation: pulse 2s ease-in-out infinite;
}

.subtitle {
  font-size: 18px;
  color: #aaa;
  margin-bottom: 40px;
}

.btn-start {
  padding: 15px 40px;
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 5px 15px rgba(255, 68, 68, 0.4);
  transition: all 0.3s ease;
}

.btn-start:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 68, 68, 0.6);
}

.btn-start:active {
  transform: translateY(0);
}

/* 일시정지 화면 */
.pause-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 100;
}

.pause-content {
  text-align: center;
  color: #fff;
}

.pause-content h2 {
  font-size: 48px;
  margin-bottom: 30px;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.btn-resume {
  padding: 12px 30px;
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  background: linear-gradient(135deg, #4444ff 0%, #0000cc 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 5px 15px rgba(68, 68, 255, 0.4);
  transition: all 0.3s ease;
}

.btn-resume:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(68, 68, 255, 0.6);
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
</style>
