<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Howl } from 'howler'

// ========== 响应式状态 ==========
const videoRef = ref(null)
const isReady = ref(false)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const INTRO_DURATION = 3.75

// 三轨音量 (0.0 ~ 1.0)
const volumes = ref({
  woman: 0.8,
  man: 0.8,
  accompaniment: 0.8,
})

// 音频实例 (非响应式，避免性能问题)
let womanSound = null
let manSound = null
let accompanimentSound = null
let syncTimer = null
let introTimer = null

// ========== 音频初始化 ==========
function initAudio() {
  // 每条音轨一个独立的 Howl 实例，独立控制音量
  womanSound = new Howl({
    src: ['/audio/musicWoman.mp3'],
    loop: true,
    volume: volumes.value.woman,
  })

  manSound = new Howl({
    src: ['/audio/musicMan.mp3'],
    loop: true,
    volume: volumes.value.man,
  })

  accompanimentSound = new Howl({
    src: ['/audio/musicAccompaniment.mp3'],
    loop: true,
    volume: volumes.value.accompaniment,
  })
}

// ========== 音量控制 ==========
function setVolume(part, value) {
  const vol = parseFloat(value)
  volumes.value[part] = vol

  const soundMap = {
    woman: womanSound,
    man: manSound,
    accompaniment: accompanimentSound,
  }

  const sound = soundMap[part]
  if (sound) {
    sound.volume(vol)
  }
}

// ========== 播放控制 ==========
function playAll() {
  if (!womanSound || !manSound || !accompanimentSound) return

  const currentVideoTime = videoRef.value?.currentTime || 0

  // 如果是从头开始（时间在 0），视频回到片头起点
  if (currentVideoTime < 0.1) {
    videoRef.value.currentTime = 0
  }

  videoRef.value.play()
  isPlaying.value = true

  scheduleAudioAfterIntro(videoRef.value.currentTime)
}

function pauseAll() {
  videoRef.value?.pause()

  // 清掉片头定时器
  if (introTimer) {
    clearTimeout(introTimer)
    introTimer = null
  }

  womanSound?.pause()
  manSound?.pause()
  accompanimentSound?.pause()

  isPlaying.value = false
  stopSyncLoop()
}

function seekAll(time) {
  const t = parseFloat(time)

  // 1. 先停掉所有音频和定时器
  if (introTimer) {
    clearTimeout(introTimer)
    introTimer = null
  }
  womanSound?.stop()
  manSound?.stop()
  accompanimentSound?.stop()

  // 2. 视频跳到目标位置
  if (videoRef.value) {
    videoRef.value.currentTime = t
  }
  currentTime.value = t

  // 3. 音频定位到对应位置（但不播）
  const audioTime = Math.max(0, t - INTRO_DURATION)
  womanSound?.seek(audioTime)
  manSound?.seek(audioTime)
  accompanimentSound?.seek(audioTime)

  // 4. 如果当前是播放状态，重新决定音频何时进来
  if (isPlaying.value) {
    scheduleAudioAfterIntro(t)
  }
}


function scheduleAudioAfterIntro(currentVideoTime) {
  // 清掉上一个等待中的定时器，避免重复触发
  if (introTimer) {
    clearTimeout(introTimer)
    introTimer = null
  }

  // 已经在片头之后：音频立刻从对应位置播
  if (currentVideoTime >= INTRO_DURATION) {
    const audioTime = currentVideoTime - INTRO_DURATION
    womanSound.seek(audioTime)
    manSound.seek(audioTime)
    accompanimentSound.seek(audioTime)
    womanSound.play()
    manSound.play()
    accompanimentSound.play()
    startSyncLoop(INTRO_DURATION)
    return
  }

  // 还在片头内：等剩余时间到了再播音频
  const remaining = INTRO_DURATION - currentVideoTime
  introTimer = setTimeout(() => {
    womanSound.seek(0)
    manSound.seek(0)
    accompanimentSound.seek(0)
    womanSound.play()
    manSound.play()
    accompanimentSound.play()
    startSyncLoop(INTRO_DURATION)
  }, remaining * 1000)
}

// ========== 视频与音频同步 ==========
// 定期校准音频进度，防止长时间播放后漂移
function startSyncLoop(offset = INTRO_DURATION) {
  stopSyncLoop()
  syncTimer = setInterval(() => {
    if (!videoRef.value || !womanSound) return

    // 视频时间减去片头偏移，才是音频应该所在的位置
    const expectedAudioTime = videoRef.value.currentTime - offset
    const audioTime = womanSound.seek()

    if (expectedAudioTime < 0) return  // 片头还没结束，不校准

    // 偏差超过 0.3 秒就强制校准
    if (Math.abs(expectedAudioTime  - audioTime) > 0.3) {
      womanSound.seek(expectedAudioTime )
      manSound?.seek(expectedAudioTime )
      accompanimentSound?.seek(expectedAudioTime )
    }
  }, 1000)
}

function stopSyncLoop() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

// ========== 视频事件处理 ==========
function onVideoLoaded() {
  isReady.value = true
  if (videoRef.value) {
    videoRef.value.muted = true
    duration.value = videoRef.value.duration || 0
  }
  initAudio()
}

function onVideoEnded() {
  pauseAll()
}

function onTimeUpdate() {
  currentTime.value = videoRef.value?.currentTime || 0
}

function onDurationChange() {
  duration.value = videoRef.value?.duration || 0
}

// ========== 时间格式化 ==========
const currentTimeText = computed(() => formatTime(currentTime.value))
const durationText = computed(() => formatTime(duration.value))

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ========== 生命周期 ==========
onMounted(() => {
  // 等待视频加载完成后初始化音频
})

onBeforeUnmount(() => {
  stopSyncLoop()
  if (introTimer) clearTimeout(introTimer)
  womanSound?.unload()
  manSound?.unload()
  accompanimentSound?.unload()
})
</script>

<template>
  <div class="sheet-music-page">
    <!-- 动态谱视频区域 -->
    <div class="video-container">
      <video
        ref="videoRef"
        class="sheet-video"
        src="/video/dynamicSheet.mp4"
        preload="metadata"
        playsinline
        muted
        @loadedmetadata="onVideoLoaded" 
        @timeupdate="onTimeUpdate"
        @durationchange="onDurationChange"
        @ended="onVideoEnded"
      ></video>

      <!-- 加载提示 -->
      <div v-if="!isReady" class="loading-overlay">
        <span>加载中...</span>
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <!-- 播放/暂停 -->
      <div class="transport-controls">
        <button class="play-btn" @click="isPlaying ? pauseAll() : playAll()" :disabled="!isReady">
          {{ isPlaying ? '暂停' : '播放' }}
        </button>
        <span class="time-display">
          {{ currentTimeText }} / {{ durationText }}
        </span>
      </div>

      <!-- 三轨音量滑块 -->
      <div class="mixer-section">
        <h3>音轨音量</h3>

        <div
          class="volume-row"
          v-for="(label, part) in { woman: '女声', man: '男声', accompaniment: '伴奏' }"
          :key="part"
        >
          <label :for="'vol-' + part">{{ label }}</label>
          <input
            :id="'vol-' + part"
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="volumes[part]"
            @input="setVolume(part, $event.target.value)"
            class="volume-slider"
          />
          <span class="volume-value">{{ Math.round(volumes[part] * 100) }}%</span>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="seek-section">
        <input
          type="range"
          min="0"
          :max="duration"
          step="0.1"
          :value="currentTime"
          @input="seekAll($event.target.value)"
          :disabled="!isReady"
          class="seek-slider"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet-music-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
  padding: 24px;
  box-sizing: border-box;
}

.video-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f0f1a;
  border-radius: 12px;
  overflow: hidden;
  min-height: 300px;
}

.sheet-video {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  font-size: 18px;
  color: #aaa;
}

.control-panel {
  margin-top: 20px;
  background: #16213e;
  border-radius: 12px;
  padding: 20px 24px;
}

.transport-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.play-btn {
  background: #e94560;
  color: white;
  border: none;
  padding: 10px 32px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.play-btn:hover:not(:disabled) {
  background: #d63850;
}

.play-btn:disabled {
  background: #555;
  cursor: not-allowed;
}

.time-display {
  font-family: monospace;
  font-size: 16px;
  color: #aaa;
}

.mixer-section {
  margin-bottom: 20px;
}

.mixer-section h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  color: #888;
  font-weight: 500;
}

.volume-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.volume-row label {
  width: 60px;
  font-size: 14px;
}

.volume-slider {
  flex: 1;
  accent-color: #e94560;
  cursor: pointer;
}

.volume-value {
  width: 48px;
  text-align: right;
  font-family: monospace;
  font-size: 14px;
  color: #aaa;
}

.seek-section {
  margin-top: 8px;
}

.seek-slider {
  width: 100%;
  accent-color: #e94560;
  cursor: pointer;
}
</style>