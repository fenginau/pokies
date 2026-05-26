import { useEffect, useRef, useState } from 'react'

const MAX_HEALTH = 5
const STAGE_CLEAR_COUNT = 15
const STAGE_INTRO_MS = 2000
const ENEMY_BASE_SIZE = 136
const SHOT_TRAVEL_MS = 260
const GUN_WRAP_LEFT_PERCENT = 46
const GUN_WRAP_WIDTH = 360
const GUN_WRAP_WIDTH_RATIO = 0.42
const GUN_WRAP_HEIGHT = 220
const GUN_MUZZLE_X_RATIO = 0.8
const GUN_MUZZLE_Y_RATIO = 0.22

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min)
}

function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1))
}

function choice(items) {
    return items[Math.floor(Math.random() * items.length)]
}

function createEnemy(now, viewport, stage, stageDestroyed, enemyId) {
    const width = viewport.width
    const height = viewport.height
    const margin = 72
    const startX = randomBetween(margin, width - margin)
    const startY = randomBetween(margin, height - margin - 180)
    const endX = randomBetween(margin, width - margin)
    const endY = randomBetween(height * 0.18, height - margin - 140)
    const stageProgress = stage < 3 ? stageDestroyed / STAGE_CLEAR_COUNT : Math.min(1, stageDestroyed / 40)

    let duration = 3800
    let movement = 'linear'

    if (stage === 1) {
        duration = Math.max(1650, 3800 - stageProgress * 1200 - randomBetween(0, 450))
        movement = 'linear'
    } else if (stage === 2) {
        duration = Math.max(1350, 3200 - stageProgress * 1200 - randomBetween(0, 500))
        movement = choice(['wave', 'curve', 'zigzag', 'drift', 'sparrow'])
    } else {
        duration = Math.max(900, 2400 - stageDestroyed * 24 - randomBetween(0, 520))
        movement = choice(['wave', 'curve', 'zigzag', 'drift', 'sparrow'])
    }

    return {
        id: enemyId,
        spawnTime: now,
        duration,
        movement,
        startX,
        startY,
        endX,
        endY,
        amplitudeX: randomBetween(26, stage === 1 ? 48 : 88),
        amplitudeY: randomBetween(14, stage === 1 ? 34 : 76),
        frequency: randomBetween(1.4, stage === 1 ? 2.2 : 3.8),
        phase: randomBetween(0, Math.PI * 2),
        rotation: randomBetween(-18, 18)
    }
}

function getEnemyPose(enemy, now, viewport) {
    const rawProgress = (now - enemy.spawnTime) / enemy.duration
    const progress = clamp(rawProgress, 0, 1)
    const baseX = enemy.startX + (enemy.endX - enemy.startX) * progress
    const baseY = enemy.startY + (enemy.endY - enemy.startY) * progress
    let offsetX = 0
    let offsetY = 0

    if (enemy.movement === 'wave') {
        offsetX = Math.sin(progress * Math.PI * enemy.frequency + enemy.phase) * enemy.amplitudeX
        offsetY = Math.cos(progress * Math.PI * 1.35 + enemy.phase) * enemy.amplitudeY * 0.42
    } else if (enemy.movement === 'curve') {
        offsetX = Math.sin(progress * Math.PI + enemy.phase) * enemy.amplitudeX
        offsetY = Math.sin(progress * Math.PI * 2 + enemy.phase) * enemy.amplitudeY * 0.22
    } else if (enemy.movement === 'zigzag') {
        offsetX =
            Math.asin(Math.sin(progress * Math.PI * enemy.frequency + enemy.phase)) *
            ((enemy.amplitudeX * 2) / Math.PI)
        offsetY = Math.sin(progress * Math.PI * 1.6 + enemy.phase) * enemy.amplitudeY * 0.18
    } else if (enemy.movement === 'drift') {
        offsetX =
            (Math.sin(progress * Math.PI * enemy.frequency + enemy.phase) +
                Math.cos(progress * Math.PI * 1.8 + enemy.phase)) *
            enemy.amplitudeX *
            0.45
        offsetY = Math.sin(progress * Math.PI * enemy.frequency * 0.65 + enemy.phase) * enemy.amplitudeY
    } else if (enemy.movement === 'sparrow') {
        offsetX = Math.sin(progress * Math.PI * enemy.frequency + enemy.phase) * enemy.amplitudeX
        offsetY =
            Math.abs(Math.sin(progress * Math.PI * (enemy.frequency + 0.8) + enemy.phase)) *
                enemy.amplitudeY -
            enemy.amplitudeY * 0.5
    } else {
        offsetX = Math.sin(progress * Math.PI * 1.2 + enemy.phase) * enemy.amplitudeX * 0.16
        offsetY = Math.cos(progress * Math.PI + enemy.phase) * enemy.amplitudeY * 0.08
    }

    const scale = 0.2 + progress * 0.8
    const size = ENEMY_BASE_SIZE * scale
    const x = clamp(baseX + offsetX, size / 2, viewport.width - size / 2)
    const y = clamp(baseY + offsetY, size / 2, viewport.height - size / 2)

    return {
        progress,
        x,
        y,
        scale
    }
}

function AttackOnAvatarGameModal({ target, onClose }) {
    const [status, setStatus] = useState('intro')
    const [stage, setStage] = useState(1)
    const [health, setHealth] = useState(MAX_HEALTH)
    const [score, setScore] = useState(0)
    const [stageDestroyed, setStageDestroyed] = useState(0)
    const [stageIntroLabel, setStageIntroLabel] = useState('Stage 1')
    const [activeEnemies, setActiveEnemies] = useState([])
    const [viewport, setViewport] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    })
    const [hitFlashKey, setHitFlashKey] = useState(0)
    const [activeProjectile, setActiveProjectile] = useState(null)

    const timersRef = useRef(new Set())
    const animationFrameRef = useRef(0)
    const enemyIdRef = useRef(0)
    const stageRef = useRef(stage)
    const healthRef = useRef(health)
    const scoreRef = useRef(score)
    const stageDestroyedRef = useRef(stageDestroyed)
    const statusRef = useRef(status)
    const activeEnemiesRef = useRef(activeEnemies)
    const viewportRef = useRef(viewport)
    const spawnTargetRef = useRef(randomInt(1, 3))
    const projectileTimeoutRef = useRef(0)
    const audioRef = useRef(null)

    useEffect(() => {
        stageRef.current = stage
    }, [stage])

    useEffect(() => {
        healthRef.current = health
    }, [health])

    useEffect(() => {
        scoreRef.current = score
    }, [score])

    useEffect(() => {
        stageDestroyedRef.current = stageDestroyed
    }, [stageDestroyed])

    useEffect(() => {
        statusRef.current = status
    }, [status])

    useEffect(() => {
        activeEnemiesRef.current = activeEnemies
    }, [activeEnemies])

    useEffect(() => {
        viewportRef.current = viewport
    }, [viewport])

    useEffect(() => {
        const handleResize = () => {
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight
            })
        }

        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    useEffect(() => {
        const audio = new Audio('/song.mp3')
        audio.loop = true
        audio.volume = 0.55
        audioRef.current = audio
        audio.play().catch(() => {})

        return () => {
            audio.pause()
            audio.currentTime = 0
            audioRef.current = null
        }
    }, [])

    useEffect(() => {
        return () => {
            cancelAnimationFrame(animationFrameRef.current)
            timersRef.current.forEach((timerId) => {
                window.clearTimeout(timerId)
            })
            window.clearTimeout(projectileTimeoutRef.current)
            timersRef.current.clear()
        }
    }, [])

    const schedule = (callback, delay) => {
        const timerId = window.setTimeout(() => {
            timersRef.current.delete(timerId)
            callback()
        }, delay)
        timersRef.current.add(timerId)
        return timerId
    }

    const setEnemies = (nextEnemies) => {
        activeEnemiesRef.current = nextEnemies
        setActiveEnemies(nextEnemies)
    }

    const triggerHitFlash = () => {
        setHitFlashKey((current) => current + 1)
    }

    const getConcurrentTarget = (nextStage, nextStageDestroyed) => {
        if (nextStage < 3) {
            return randomInt(1, 3)
        }

        return randomInt(2, 4) + Math.floor(nextStageDestroyed / 10)
    }

    const beginStageIntro = (nextStage, nextScore = scoreRef.current) => {
        cancelAnimationFrame(animationFrameRef.current)
        setStage(nextStage)
        stageRef.current = nextStage
        setStageDestroyed(0)
        stageDestroyedRef.current = 0
        setScore(nextScore)
        scoreRef.current = nextScore
        setStageIntroLabel(`Stage ${nextStage}`)
        spawnTargetRef.current = getConcurrentTarget(nextStage, 0)
        setEnemies([])
        setActiveProjectile(null)
        setStatus('stageIntro')
        statusRef.current = 'stageIntro'

        schedule(() => {
            setStatus('playing')
            statusRef.current = 'playing'
        }, STAGE_INTRO_MS)
    }

    const finishGame = () => {
        cancelAnimationFrame(animationFrameRef.current)
        setEnemies([])
        setActiveProjectile(null)
        setStatus('gameOver')
        statusRef.current = 'gameOver'
    }

    const runFrame = (now) => {
        if (statusRef.current !== 'playing') {
            return
        }

        let hitCount = 0
        let nextEnemies = activeEnemiesRef.current
            .map((enemy) => {
                if (enemy.isFrozen) {
                    return enemy
                }

                const pose = getEnemyPose(enemy, now, viewportRef.current)
                return {
                    ...enemy,
                    ...pose
                }
            })
            .filter((enemy) => {
                if (enemy.progress >= 1) {
                    hitCount += 1
                    return false
                }

                return true
            })

        if (hitCount > 0) {
            const nextHealth = Math.max(0, healthRef.current - hitCount)
            healthRef.current = nextHealth
            setHealth(nextHealth)
            triggerHitFlash()

            if (nextHealth <= 0) {
                finishGame()
                return
            }
        }

        if (stageRef.current === 3) {
            spawnTargetRef.current = getConcurrentTarget(3, stageDestroyedRef.current)
        } else if (nextEnemies.length === 0) {
            spawnTargetRef.current = getConcurrentTarget(stageRef.current, stageDestroyedRef.current)
        }

        while (nextEnemies.length < spawnTargetRef.current) {
            enemyIdRef.current += 1
            nextEnemies.push(
                createEnemy(
                    now,
                    viewportRef.current,
                    stageRef.current,
                    stageDestroyedRef.current,
                    enemyIdRef.current
                )
            )
        }

        setEnemies(nextEnemies)
        animationFrameRef.current = window.requestAnimationFrame(runFrame)
    }

    useEffect(() => {
        if (status !== 'playing') {
            cancelAnimationFrame(animationFrameRef.current)
            return undefined
        }

        animationFrameRef.current = window.requestAnimationFrame(runFrame)
        return () => {
            cancelAnimationFrame(animationFrameRef.current)
        }
    }, [status])

    const handleStart = () => {
        setHealth(MAX_HEALTH)
        healthRef.current = MAX_HEALTH
        setScore(0)
        scoreRef.current = 0
        beginStageIntro(1, 0)
    }

    const handleRetry = () => {
        timersRef.current.forEach((timerId) => {
            window.clearTimeout(timerId)
        })
        window.clearTimeout(projectileTimeoutRef.current)
        timersRef.current.clear()
        setHitFlashKey(0)
        handleStart()
    }

    const getGunMuzzlePosition = () => {
        const wrapWidth = Math.min(GUN_WRAP_WIDTH, viewportRef.current.width * GUN_WRAP_WIDTH_RATIO)
        const wrapHeight = Math.min(GUN_WRAP_HEIGHT, viewportRef.current.height * 0.28)
        const wrapLeft = viewportRef.current.width * (GUN_WRAP_LEFT_PERCENT / 100) - wrapWidth / 2
        const wrapTop = viewportRef.current.height - wrapHeight

        return {
            x: wrapLeft + wrapWidth * GUN_MUZZLE_X_RATIO,
            y: wrapTop + wrapHeight * GUN_MUZZLE_Y_RATIO
        }
    }

    const handleEnemyDestroy = (enemyId) => {
        if (statusRef.current !== 'playing') {
            return
        }

        const targetEnemy = activeEnemiesRef.current.find((enemy) => enemy.id === enemyId)
        if (!targetEnemy || targetEnemy.isFrozen) {
            return
        }

        const frozenEnemies = activeEnemiesRef.current.map((enemy) =>
            enemy.id === enemyId ? { ...enemy, isFrozen: true } : enemy
        )
        setEnemies(frozenEnemies)

        const muzzle = getGunMuzzlePosition()
        setActiveProjectile({
            id: `${enemyId}-${Date.now()}`,
            startX: muzzle.x,
            startY: muzzle.y,
            endX: targetEnemy.x,
            endY: targetEnemy.y
        })

        window.clearTimeout(projectileTimeoutRef.current)
        projectileTimeoutRef.current = window.setTimeout(() => {
            setActiveProjectile(null)

            const remainingEnemies = activeEnemiesRef.current.filter((enemy) => enemy.id !== enemyId)
            setEnemies(remainingEnemies)

            const nextScore = scoreRef.current + 1
            scoreRef.current = nextScore
            setScore(nextScore)

            const currentStage = stageRef.current
            const nextStageDestroyed = stageDestroyedRef.current + 1

            if (currentStage < 3 && nextStageDestroyed >= STAGE_CLEAR_COUNT) {
                beginStageIntro(currentStage + 1, nextScore)
                return
            }

            stageDestroyedRef.current = nextStageDestroyed
            setStageDestroyed(nextStageDestroyed)

            if (currentStage < 3 && remainingEnemies.length === 0) {
                spawnTargetRef.current = getConcurrentTarget(currentStage, nextStageDestroyed)
            }

            if (currentStage === 3) {
                spawnTargetRef.current = getConcurrentTarget(3, nextStageDestroyed)
            }
        }, SHOT_TRAVEL_MS)
    }

    const hearts = Array.from({ length: MAX_HEALTH }, (_, index) => index < health)

    return (
        <div className='attack-game-modal' role='dialog' aria-modal='true'>
            <button type='button' className='attack-game-close' onClick={onClose} aria-label='Close game'>
                ×
            </button>

            <div className='attack-game-gun-wrap' aria-hidden='true'>
                <img src='/gun.png' alt='' className='attack-game-gun' />
            </div>
            {activeProjectile ? (
                <div
                    className='attack-game-bullet'
                    style={{
                        '--attack-shot-start-x': `${activeProjectile.startX}px`,
                        '--attack-shot-start-y': `${activeProjectile.startY}px`,
                        '--attack-shot-end-x': `${activeProjectile.endX}px`,
                        '--attack-shot-end-y': `${activeProjectile.endY}px`
                    }}
                    aria-hidden='true'
                />
            ) : null}

            <div className='attack-game-hearts' aria-hidden='true'>
                {hearts.map((isFilled, index) => (
                    <span
                        key={index}
                        className={`attack-game-heart ${isFilled ? 'is-filled' : 'is-empty'}`}>
                        ♥
                    </span>
                ))}
            </div>

            {(status === 'playing' || status === 'stageIntro' || status === 'gameOver') ? (
                <div className='attack-game-hud'>
                    <div>Stage {stage}</div>
                    <div>Destroyed {stageDestroyed}</div>
                    <div>Score {score}</div>
                </div>
            ) : null}

            {status === 'intro' ? (
                <div className='attack-game-center-panel'>
                    <h2>{`Attack on ${target.label}`}</h2>
                    <button type='button' className='attack-game-primary' onClick={handleStart}>
                        Click to Start
                    </button>
                </div>
            ) : null}

            {status === 'stageIntro' ? (
                <div className='attack-game-stage-intro'>{stageIntroLabel}</div>
            ) : null}

            {status === 'playing'
                ? activeEnemies.map((enemy) => (
                      <button
                          key={enemy.id}
                          type='button'
                          className='attack-game-enemy'
                          onClick={() => handleEnemyDestroy(enemy.id)}
                          style={{
                              left: `${enemy.x}px`,
                              top: `${enemy.y}px`,
                              transform: `translate(-50%, -50%) scale(${enemy.scale}) rotate(${enemy.rotation}deg)`
                          }}
                          aria-label={`Shoot ${target.label}`}>
                          <span className='attack-game-enemy-shell'>
                              {target.avatarSrc ? (
                                  <img
                                      src={target.avatarSrc}
                                      alt={target.label}
                                      className='attack-game-enemy-avatar'
                                      onError={(event) => {
                                          event.currentTarget.onerror = null
                                          event.currentTarget.src =
                                              target.avatarFallbackSrc || '/avatars/unknown.png'
                                      }}
                                  />
                              ) : (
                                  <span className='attack-game-enemy-text'>
                                      {target.displayLabel || target.id}
                                  </span>
                              )}
                          </span>
                      </button>
                  ))
                : null}

            {status === 'gameOver' ? (
                <div className='attack-game-center-panel is-game-over'>
                    <h2>You Lose</h2>
                    <p>{`Final stage: ${stage}`}</p>
                    <p>{`Final score: ${score}`}</p>
                    <div className='attack-game-actions'>
                        <button type='button' className='attack-game-secondary' onClick={onClose}>
                            Exit
                        </button>
                        <button type='button' className='attack-game-primary' onClick={handleRetry}>
                            Retry
                        </button>
                    </div>
                </div>
            ) : null}

            {hitFlashKey ? (
                <div key={hitFlashKey} className='attack-game-hit-flash' aria-hidden='true' />
            ) : null}
        </div>
    )
}

export default AttackOnAvatarGameModal
