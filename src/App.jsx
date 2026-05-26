import { useMemo, useState } from 'react'
import ControlPanel from './components/ControlPanel'
import PingPongDrawMachine from './components/PingPongDrawMachine'
import { clampDrawCount, createMachineOption, parseOptions } from './utils/draw'

const DEFAULT_FELLOW_AVATAR_SRC = '/avatars/unknown.png'

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

    const presetOptions = PRESETS[presetKey] || EMPTY_PRESET_OPTIONS
    const presetOptionMap = useMemo(() => getPresetOptionMap(presetOptions), [presetOptions])
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
            const nextSelection =
                current.indexOf(optionId) !== -1
                    ? current.filter((item) => item !== optionId)
                    : getPresetOptionIds(presetOptions).filter(
                          (presetOptionId) =>
                              presetOptionId === optionId || current.indexOf(presetOptionId) !== -1
                      )

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

        setResults([])
        setIsDrawing(true)
        setStatus('Mixing balls...')
        setRunSeed((current) => current + 1)
        setIsDrawerOpen(false)
        setIsResultsModalOpen(false)
    }

    const handleReset = () => {
        setIsDrawing(false)
        setResults([])
        setStatus('Ready')
        setResetToken((current) => current + 1)
        setIsResultsModalOpen(false)
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
                                {fellowResults.map((result, index) => (
                                    <li key={`${result.id}-${index}`} className='fellow-result-card'>
                                        <div className='fellow-result-rank'>{index + 1}</div>
                                        <div className='fellow-result-ball'>
                                            {result.avatarSrc ? (
                                                <img
                                                    src={result.avatarSrc}
                                                    alt={result.label}
                                                    className='fellow-result-avatar'
                                                    onError={(event) => {
                                                        event.currentTarget.onerror = null
                                                        event.currentTarget.src =
                                                            result.avatarFallbackSrc ||
                                                            DEFAULT_FELLOW_AVATAR_SRC
                                                    }}
                                                />
                                            ) : (
                                                <span className='fellow-result-initials'>
                                                    {result.displayLabel || result.id}
                                                </span>
                                            )}
                                        </div>
                                        <div className='fellow-result-name'>{result.label}</div>
                                    </li>
                                ))}
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
        </main>
    )
}

export default App
