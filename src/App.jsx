import { useEffect, useMemo, useRef, useState } from 'react'
import Matter from 'matter-js'
import ControlPanel from './components/ControlPanel'
import PingPongDrawMachine from './components/PingPongDrawMachine'
import { clampDrawCount, createMachineOption, parseOptions } from './utils/draw'

const DEFAULT_FELLOW_AVATAR_SRC = '/avatars/unknown.png'
const DROPPED_BALL_SIZE = 112
const DROPPED_BALL_RADIUS = DROPPED_BALL_SIZE / 2
const DROPPED_BALL_FLOOR_HEIGHT = 48
const DROP_SETTLE_SPEED = 0.14
const DROP_SETTLE_ANGULAR_SPEED = 0.02
const DROP_SETTLE_FRAMES = 18
const DROP_REPLACEMENT_TIMEOUT_MS = 5000
const DROP_SIDE_WALL_THICKNESS = 120
const DROP_OVERFLOW_THRESHOLD = 10
const DROP_OVERFLOW_INTERVAL_MS = 250

const PRESETS = {
    iceCream: [
        { id: 'banana', label: 'Banana' },
        { id: 'blueberry', label: 'Blueberry' },
        { id: 'caramel', label: 'Caramel' },
        { id: 'chocolate', label: 'Chocolate' },
        { id: 'coffee', label: 'Coffee' },
        { id: 'coconut', label: 'Coconut' },
        { id: 'cookies-cream', label: 'Cookies & Cream' },
        { id: 'black-pepper', label: 'Black Pepper' },
        { id: 'mango', label: 'Mango' },
        { id: 'milo', label: 'Milo' },
        { id: 'mint', label: 'Mint' },
        { id: 'matcha', label: 'Matcha' },
        { id: 'pistachio', label: 'Pistachio' },
        { id: 'rum-raisin', label: 'Rum Raisin' },
        { id: 'strawberry', label: 'Strawberry' },
        { id: 'taro', label: 'Taro' },
        { id: 'vanilla', label: 'Vanilla' }
    ],
    initials: [
        {
            id: 'AP',
            label: 'Asher Pakula',
            displayLabel: 'AP',
            avatarSrc: '/avatars/AP.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'DZ',
            label: 'Daniel Zelenko',
            displayLabel: 'DZ',
            avatarSrc: '/avatars/DZ.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'GF',
            label: 'Guoxiao Feng',
            displayLabel: 'GF',
            avatarSrc: '/avatars/GF.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'HK',
            label: 'Henry Kerr',
            displayLabel: 'HK',
            avatarSrc: '/avatars/HK.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'JH',
            label: 'Jay Hamilton',
            displayLabel: 'JH',
            avatarSrc: '/avatars/JH.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'JB',
            label: 'Josh Boul',
            displayLabel: 'JB',
            avatarSrc: '/avatars/JB.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'MM',
            label: 'Mayank Mongia',
            displayLabel: 'MM',
            avatarSrc: '/avatars/MM.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'MI',
            label: 'Moin Iqbal',
            displayLabel: 'MI',
            avatarSrc: '/avatars/MI.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'SG',
            label: 'Shelly Giddens',
            displayLabel: 'SG',
            avatarSrc: '/avatars/SG.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'SN',
            label: 'Steven Nocker',
            displayLabel: 'SN',
            avatarSrc: '/avatars/SN.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        },
        {
            id: 'SW',
            label: 'Steve Whatman',
            displayLabel: 'SW',
            avatarSrc: '/avatars/SW.png',
            avatarFallbackSrc: DEFAULT_FELLOW_AVATAR_SRC
        }
    ]
}
const EMPTY_PRESET_OPTIONS = []

function getPresetOptionIds(presetOptions) {
    return presetOptions.map((option) => option.id)
}

function getPresetOptionMap(presetOptions) {
    const optionMap = {}
    presetOptions.forEach((option) => {
        optionMap[option.id] = option
    })
    return optionMap
}

function getPresetOptionLabelMap(presetOptions) {
    const optionMap = {}
    presetOptions.forEach((option) => {
        optionMap[option.label] = option
    })
    return optionMap
}

function App() {
    const [presetKey, setPresetKey] = useState('initials')
    const [optionsText, setOptionsText] = useState(
        PRESETS.initials.map((option) => option.label).join('\n')
    )
    const [selectedPresetOptions, setSelectedPresetOptions] = useState(
        getPresetOptionIds(PRESETS.initials)
    )
    const [drawCount, setDrawCount] = useState(3)
    const [status, setStatus] = useState('Ready')
    const [results, setResults] = useState([])
    const [isDrawing, setIsDrawing] = useState(false)
    const [runSeed, setRunSeed] = useState(0)
    const [resetToken, setResetToken] = useState(0)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false)
    const [droppedBalls, setDroppedBalls] = useState([])
    const [droppedResultReplacements, setDroppedResultReplacements] = useState({})
    const [lastToggledOnFellowId, setLastToggledOnFellowId] = useState('MM')
    const droppedBodiesRef = useRef(new Map())
    const droppedNodesRef = useRef(new Map())
    const droppedBallMetaRef = useRef(new Map())
    const dropRevealTimeoutsRef = useRef(new Map())
    const dropOverflowIntervalsRef = useRef(new Map())
    const droppedBallCountsRef = useRef(new Map())
    const physicsRef = useRef(null)
    const animationFrameRef = useRef(0)
    const droppedBallIdRef = useRef(0)

    const presetOptions = PRESETS[presetKey] || EMPTY_PRESET_OPTIONS
    const presetOptionMap = useMemo(() => getPresetOptionMap(presetOptions), [presetOptions])
    const fellowIdMap = useMemo(() => getPresetOptionMap(PRESETS.initials), [])
    const fellowLabelMap = useMemo(() => getPresetOptionLabelMap(PRESETS.initials), [])
    const parsedOptions = useMemo(() => {
        if (presetKey === 'custom') {
            return parseOptions(optionsText)
        }

        return selectedPresetOptions
            .map((optionId) => presetOptionMap[optionId])
            .filter(Boolean)
            .map((option, index) => createMachineOption(option, index))
    }, [optionsText, presetKey, presetOptionMap, selectedPresetOptions])
    const fellowResults = useMemo(
        () =>
            results
                .map((result) => fellowLabelMap[result])
                .filter(Boolean),
        [fellowLabelMap, results]
    )
    const defaultReplacementFellow = fellowIdMap.MM || PRESETS.initials.find((option) => option.id === 'MM')
    const shouldShowFellowResults = presetKey === 'initials' && fellowResults.length === results.length
    const optionCount = parsedOptions.length
    const safeDrawCount = clampDrawCount(drawCount, optionCount)

    const validationMessage = useMemo(() => {
        if (optionCount === 0) {
            return 'Please enter at least one option.'
        }
        if (Number.isNaN(Number(drawCount)) || Number(drawCount) < 1) {
            return 'Draw count must be at least 1.'
        }
        if (Number(drawCount) > optionCount) {
            return 'Draw count cannot exceed option count.'
        }
        return ''
    }, [drawCount, optionCount])

    const canStart = !isDrawing && !validationMessage && optionCount > 0

    useEffect(() => {
        const { Engine, Runner, Bodies, Composite } = Matter
        const engine = Engine.create({
            gravity: { x: 0, y: 0.9 }
        })
        const runner = Runner.create()
        const floor = Bodies.rectangle(
            window.innerWidth / 2,
            window.innerHeight + DROPPED_BALL_FLOOR_HEIGHT / 2,
            Math.max(window.innerWidth * 3, 4000),
            DROPPED_BALL_FLOOR_HEIGHT,
            {
                isStatic: true
            }
        )
        const leftWall = Bodies.rectangle(
            -DROP_SIDE_WALL_THICKNESS / 2,
            window.innerHeight / 2,
            DROP_SIDE_WALL_THICKNESS,
            window.innerHeight * 3,
            {
                isStatic: true
            }
        )
        const rightWall = Bodies.rectangle(
            window.innerWidth + DROP_SIDE_WALL_THICKNESS / 2,
            window.innerHeight / 2,
            DROP_SIDE_WALL_THICKNESS,
            window.innerHeight * 3,
            {
                isStatic: true
            }
        )

        Composite.add(engine.world, [floor, leftWall, rightWall])
        Runner.run(runner, engine)

        physicsRef.current = { engine, runner, floor, leftWall, rightWall }

        const syncFloor = () => {
            if (!physicsRef.current) {
                return
            }

            Matter.Body.setPosition(physicsRef.current.floor, {
                x: window.innerWidth / 2,
                y: window.innerHeight + DROPPED_BALL_FLOOR_HEIGHT / 2
            })
            Matter.Body.setPosition(physicsRef.current.leftWall, {
                x: -DROP_SIDE_WALL_THICKNESS / 2,
                y: window.innerHeight / 2
            })
            Matter.Body.setPosition(physicsRef.current.rightWall, {
                x: window.innerWidth + DROP_SIDE_WALL_THICKNESS / 2,
                y: window.innerHeight / 2
            })
        }

        const renderDroppedBalls = () => {
            droppedBodiesRef.current.forEach((body, id) => {
                const node = droppedNodesRef.current.get(id)
                if (!node) {
                    return
                }

                const meta = droppedBallMetaRef.current.get(id)
                if (meta && !meta.hasSettled) {
                    const isOnGround =
                        body.position.y >=
                        window.innerHeight - DROPPED_BALL_RADIUS - DROP_SETTLE_SPEED * 10
                    const isSlowEnough =
                        Math.abs(body.velocity.x) < DROP_SETTLE_SPEED &&
                        Math.abs(body.velocity.y) < DROP_SETTLE_SPEED &&
                        Math.abs(body.angularVelocity) < DROP_SETTLE_ANGULAR_SPEED

                    if (isOnGround && isSlowEnough) {
                        meta.stillFrames += 1
                        if (meta.stillFrames >= DROP_SETTLE_FRAMES) {
                            meta.hasSettled = true
                            revealDroppedReplacement(meta.resultKey)
                        }
                    } else {
                        meta.stillFrames = 0
                    }
                }

                node.style.transform = `translate(${body.position.x - DROPPED_BALL_RADIUS}px, ${
                    body.position.y - DROPPED_BALL_RADIUS
                }px) rotate(${body.angle}rad)`
            })

            animationFrameRef.current = window.requestAnimationFrame(renderDroppedBalls)
        }

        animationFrameRef.current = window.requestAnimationFrame(renderDroppedBalls)
        window.addEventListener('resize', syncFloor)

        return () => {
            window.removeEventListener('resize', syncFloor)
            window.cancelAnimationFrame(animationFrameRef.current)
            Runner.stop(runner)
            Matter.World.clear(engine.world, false)
            Matter.Engine.clear(engine)
            physicsRef.current = null
            droppedBodiesRef.current.clear()
            droppedNodesRef.current.clear()
            droppedBallMetaRef.current.clear()
            dropRevealTimeoutsRef.current.clear()
            dropOverflowIntervalsRef.current.clear()
            droppedBallCountsRef.current.clear()
        }
    }, [])

    useEffect(() => {
        if (isResultsModalOpen) {
            return
        }

        clearDroppedBalls()
    }, [isResultsModalOpen])

    const handleOptionsChange = (value) => {
        setOptionsText(value)

        const nextCount = parseOptions(value).length
        setDrawCount((current) => clampDrawCount(current, nextCount))
    }

    const handleDrawCountChange = (value) => {
        if (value === '') {
            setDrawCount('')
            return
        }

        setDrawCount(Number(value))
    }

    const handlePresetChange = (nextPresetKey) => {
        setPresetKey(nextPresetKey)
        if (nextPresetKey !== 'custom') {
            const nextPresetOptions = PRESETS[nextPresetKey]
            const nextSelectedIds = getPresetOptionIds(nextPresetOptions)
            const presetText = nextPresetOptions.map((option) => option.label).join('\n')
            setSelectedPresetOptions(nextSelectedIds)
            setOptionsText(presetText)
            setDrawCount((current) => clampDrawCount(current, nextPresetOptions.length))
        }
    }

    const handlePresetOptionToggle = (optionId) => {
        setSelectedPresetOptions((current) => {
            const isAlreadySelected = current.indexOf(optionId) !== -1
            const nextSelection =
                isAlreadySelected
                    ? current.filter((item) => item !== optionId)
                    : getPresetOptionIds(presetOptions).filter(
                          (presetOptionId) =>
                              presetOptionId === optionId || current.indexOf(presetOptionId) !== -1
                      )

            if (!isAlreadySelected && fellowLabelMap[presetOptionMap[optionId]?.label]) {
                setLastToggledOnFellowId(optionId)
            }

            setOptionsText(
                nextSelection
                    .map((selectedId) => presetOptionMap[selectedId])
                    .filter(Boolean)
                    .map((option) => option.label)
                    .join('\n')
            )
            setDrawCount((drawValue) => clampDrawCount(drawValue, nextSelection.length))
            return nextSelection
        })
    }

    const handleStart = () => {
        if (!canStart) {
            return
        }

        clearDroppedBalls()
        setResults([])
        setIsDrawing(true)
        setStatus('Mixing balls...')
        setRunSeed((current) => current + 1)
        setIsDrawerOpen(false)
        setIsResultsModalOpen(false)
    }

    const handleReset = () => {
        clearDroppedBalls()
        setIsDrawing(false)
        setResults([])
        setStatus('Ready')
        setResetToken((current) => current + 1)
        setIsResultsModalOpen(false)
    }

    const clearDroppedBalls = () => {
        if (physicsRef.current) {
            droppedBodiesRef.current.forEach((body) => {
                Matter.Composite.remove(physicsRef.current.engine.world, body)
            })
        }

        dropRevealTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId)
        })
        dropOverflowIntervalsRef.current.forEach((intervalId) => {
            window.clearInterval(intervalId)
        })

        droppedBodiesRef.current.clear()
        droppedNodesRef.current.clear()
        droppedBallMetaRef.current.clear()
        dropRevealTimeoutsRef.current.clear()
        dropOverflowIntervalsRef.current.clear()
        droppedBallCountsRef.current.clear()
        setDroppedBalls([])
        setDroppedResultReplacements({})
    }

    const registerDroppedBallNode = (id, node) => {
        if (!node) {
            droppedNodesRef.current.delete(id)
            return
        }

        droppedNodesRef.current.set(id, node)
    }

    const revealDroppedReplacement = (resultKey) => {
        const timeoutId = dropRevealTimeoutsRef.current.get(resultKey)
        if (timeoutId) {
            window.clearTimeout(timeoutId)
            dropRevealTimeoutsRef.current.delete(resultKey)
        }

        setDroppedResultReplacements((current) => {
            const next = current[resultKey]
            if (!next || next.isVisible) {
                return current
            }

            return {
                ...current,
                [resultKey]: {
                    ...next,
                    isVisible: true
                }
            }
        })
    }

    const spawnDroppedBall = (result, resultKey, positionOverride) => {
        if (!physicsRef.current) {
            return
        }

        const dropId = `dropped-ball-${droppedBallIdRef.current + 1}`
        droppedBallIdRef.current += 1
        const startX = positionOverride?.x ?? window.innerWidth / 2
        const startY = positionOverride?.y ?? DROPPED_BALL_RADIUS
        const body = Matter.Bodies.circle(startX, startY, DROPPED_BALL_RADIUS, {
            restitution: 0.82,
            friction: 0.02,
            frictionAir: 0.014,
            density: 0.0015
        })

        droppedBodiesRef.current.set(dropId, body)
        droppedBallMetaRef.current.set(dropId, {
            resultKey,
            hasSettled: false,
            stillFrames: 0
        })
        Matter.Composite.add(physicsRef.current.engine.world, body)
        setDroppedBalls((current) => [
            ...current,
            {
                id: dropId,
                label: result.label,
                displayLabel: result.displayLabel || result.id,
                avatarSrc: result.avatarSrc || null,
                avatarFallbackSrc: result.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC
            }
        ])
    }

    const ensureOverflowDropper = (result) => {
        const personKey = result.id || result.label
        const currentCount = droppedBallCountsRef.current.get(personKey) || 0
        if (currentCount <= DROP_OVERFLOW_THRESHOLD) {
            return
        }

        if (dropOverflowIntervalsRef.current.has(personKey)) {
            return
        }

        const intervalId = window.setInterval(() => {
            const maxX = window.innerWidth - DROPPED_BALL_RADIUS
            const minX = DROPPED_BALL_RADIUS
            const randomX = minX + Math.random() * Math.max(1, maxX - minX)
            spawnDroppedBall(result, `overflow-${personKey}`, {
                x: randomX,
                y: -DROPPED_BALL_RADIUS
            })
            droppedBallCountsRef.current.set(
                personKey,
                (droppedBallCountsRef.current.get(personKey) || 0) + 1
            )
        }, DROP_OVERFLOW_INTERVAL_MS)

        dropOverflowIntervalsRef.current.set(personKey, intervalId)
    }

    const handleDropResultBall = (result, resultKey) => {
        if (!physicsRef.current) {
            return
        }

        const triggerNode = document.getElementById(resultKey)
        const bounds = triggerNode?.getBoundingClientRect()

        if (!bounds) {
            return
        }

        const startX = bounds.left + bounds.width / 2
        const startY = bounds.top + bounds.height / 2
        spawnDroppedBall(result, resultKey, { x: startX, y: startY })
        const personKey = result.id || result.label
        droppedBallCountsRef.current.set(personKey, (droppedBallCountsRef.current.get(personKey) || 0) + 1)
        ensureOverflowDropper(result)
        setDroppedResultReplacements((current) => ({
            ...current,
            [resultKey]: {
                fellow: fellowIdMap[lastToggledOnFellowId] || defaultReplacementFellow || result,
                isVisible: false
            }
        }))
        const revealTimeoutId = window.setTimeout(() => {
            revealDroppedReplacement(resultKey)
        }, DROP_REPLACEMENT_TIMEOUT_MS)
        dropRevealTimeoutsRef.current.set(resultKey, revealTimeoutId)
    }

    return (
        <main className='app-shell'>
            <button
                type='button'
                className='drawer-toggle'
                onClick={() => setIsDrawerOpen((current) => !current)}
                aria-expanded={isDrawerOpen}
                aria-controls='controls-drawer'>
                {isDrawerOpen ? 'Close Controls' : 'Open Controls'}
            </button>

            <div
                className={`drawer-scrim ${isDrawerOpen ? 'is-open' : ''}`}
                onClick={() => setIsDrawerOpen(false)}
                aria-hidden={!isDrawerOpen}
            />

            <aside
                id='controls-drawer'
                className={`controls-drawer ${isDrawerOpen ? 'is-open' : ''}`}>
                <ControlPanel
                    presetKey={presetKey}
                    optionsText={optionsText}
                    presetOptions={presetOptions}
                    selectedPresetOptions={selectedPresetOptions}
                    drawCount={drawCount}
                    maxDrawCount={optionCount}
                    validationMessage={validationMessage}
                    isDrawing={isDrawing}
                    onPresetChange={handlePresetChange}
                    onPresetOptionToggle={handlePresetOptionToggle}
                    onOptionsChange={handleOptionsChange}
                    onDrawCountChange={handleDrawCountChange}
                    onReset={handleReset}
                />
            </aside>

            <section className='content-grid'>
                <div className='machine-column'>
                    <PingPongDrawMachine
                        options={parsedOptions}
                        drawCount={safeDrawCount}
                        runSeed={runSeed}
                        resetToken={resetToken}
                        isDrawing={isDrawing}
                        onStatusChange={setStatus}
                        onResultsChange={setResults}
                        onDrawComplete={() => {
                            setIsDrawing(false)
                            setIsResultsModalOpen(true)
                        }}
                    />
                    <button
                        type='button'
                        className='machine-draw-button'
                        onClick={handleStart}
                        disabled={!canStart}>
                        Start Draw
                    </button>
                </div>
            </section>

            {isResultsModalOpen ? (
                <div
                    className='results-modal-backdrop'
                    onClick={() => setIsResultsModalOpen(false)}>
                    <section
                        className='results-modal panel'
                        onClick={(event) => event.stopPropagation()}>
                        <div className='results-modal-header'>
                            <div>
                                <h2>Results</h2>
                                <p>{status}</p>
                            </div>
                            <button
                                type='button'
                                className='results-modal-close'
                                onClick={() => setIsResultsModalOpen(false)}>
                                Close
                            </button>
                        </div>

                        {shouldShowFellowResults ? (
                            <ol className='fellow-results-row'>
                                {fellowResults.map((result, index) => {
                                    const resultKey = `fellow-result-ball-${result.id}-${index}`
                                    const replacement = droppedResultReplacements[resultKey]
                                    const displayedResult = replacement?.fellow || result
                                    const isReplacementPending = Boolean(replacement && !replacement.isVisible)
                                    const isReplacementVisible = Boolean(replacement?.isVisible)

                                    return (
                                        <li key={`${result.id}-${index}`} className='fellow-result-card'>
                                            <div className='fellow-result-rank'>{index + 1}</div>
                                            <button
                                                type='button'
                                                id={resultKey}
                                                className={`fellow-result-ball ${
                                                    isReplacementPending ? 'is-waiting-replacement' : ''
                                                }`}
                                                onClick={() =>
                                                    handleDropResultBall(displayedResult, resultKey)
                                                }
                                                disabled={isReplacementPending}
                                                aria-label={`Drop ${displayedResult.label} ball`}>
                                                {displayedResult.avatarSrc ? (
                                                    <img
                                                        src={displayedResult.avatarSrc}
                                                        alt={displayedResult.label}
                                                        className={`fellow-result-avatar ${
                                                            isReplacementVisible
                                                                ? 'is-replacement-visible'
                                                                : ''
                                                        }`}
                                                        onError={(event) => {
                                                            event.currentTarget.onerror = null
                                                            event.currentTarget.src =
                                                                displayedResult.avatarFallbackSrc ||
                                                                DEFAULT_FELLOW_AVATAR_SRC
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        className={`fellow-result-initials ${
                                                            isReplacementVisible
                                                                ? 'is-replacement-visible'
                                                                : ''
                                                        }`}>
                                                        {displayedResult.displayLabel ||
                                                            displayedResult.id}
                                                    </span>
                                                )}
                                            </button>
                                            <div
                                                className={`fellow-result-name ${
                                                    isReplacementPending
                                                        ? 'is-waiting-replacement'
                                                        : ''
                                                } ${
                                                    isReplacementVisible
                                                        ? 'is-replacement-visible'
                                                        : ''
                                                }`}>
                                                {displayedResult.label}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>
                        ) : (
                            <ol className='results-list'>
                                {results.map((result, index) => (
                                    <li key={`${result}-${index}`} className='result-item'>
                                        <span className='result-order'>{index + 1}</span>
                                        <span className='result-value'>{result}</span>
                                    </li>
                                ))}
                            </ol>
                        )}

                        {!results.length ? (
                            <div className='results-empty'>No balls reached the rail yet.</div>
                        ) : null}
                    </section>
                </div>
            ) : null}
            <div className='dropped-balls-layer' aria-hidden='true'>
                {droppedBalls.map((ball) => (
                    <div
                        key={ball.id}
                        ref={(node) => registerDroppedBallNode(ball.id, node)}
                        className='dropped-result-ball'>
                        {ball.avatarSrc ? (
                            <img
                                src={ball.avatarSrc}
                                alt=''
                                className='fellow-result-avatar'
                                onError={(event) => {
                                    event.currentTarget.onerror = null
                                    event.currentTarget.src =
                                        ball.avatarFallbackSrc || DEFAULT_FELLOW_AVATAR_SRC
                                }}
                            />
                        ) : (
                            <span className='fellow-result-initials'>{ball.displayLabel}</span>
                        )}
                    </div>
                ))}
            </div>
        </main>
    )
}

export default App
