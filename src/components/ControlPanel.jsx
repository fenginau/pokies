function ControlPanel({
    presetKey,
    optionsText,
    presetOptions,
    selectedPresetOptions,
    drawCount,
    maxDrawCount,
    validationMessage,
    isDrawing,
    onPresetChange,
    onPresetOptionToggle,
    onOptionsChange,
    onDrawCountChange,
    onReset,
}) {
    const isCustomPreset = presetKey === 'custom'

    return (
        <section className='panel control-panel'>
            <div className='panel-heading'>
                <h2>Controls</h2>
                <p>Choose a preset or switch to custom options.</p>
            </div>

            <label className='field'>
                <span>Preset</span>
                <select
                    value={presetKey}
                    onChange={(event) => onPresetChange(event.target.value)}
                    disabled={isDrawing}>
                    <option value='iceCream'>Ice-Cream</option>
                    <option value='initials'>Fellows</option>
                    <option value='custom'>Custom</option>
                </select>
            </label>

            {isCustomPreset ? (
                <label className='field'>
                    <span>Options</span>
                    <textarea
                        value={optionsText}
                        onChange={(event) => onOptionsChange(event.target.value)}
                        rows={10}
                        placeholder={'Apple\nBanana\nOrange\nMango'}
                        disabled={isDrawing}
                    />
                </label>
            ) : (
                <div className='field'>
                    <span>Options</span>
                    <div className='preset-options-list'>
                        {presetOptions.map((option) => {
                            const isChecked = selectedPresetOptions.indexOf(option.id) !== -1
                            return (
                                <label key={option.id} className='preset-option-item'>
                                    <input
                                        type='checkbox'
                                        checked={isChecked}
                                        onChange={() => onPresetOptionToggle(option.id)}
                                        disabled={isDrawing}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            )
                        })}
                    </div>
                </div>
            )}

            <label className='field'>
                <span>Number of balls to draw</span>
                <input
                    type='number'
                    min='1'
                    max={Math.max(1, maxDrawCount)}
                    value={drawCount}
                    onChange={(event) => onDrawCountChange(event.target.value)}
                    disabled={isDrawing}
                />
            </label>

            <div className='meta-row'>
                <span>{maxDrawCount} options loaded</span>
                <span>Max draw: {maxDrawCount || 0}</span>
            </div>

            {validationMessage ? <p className='validation-message'>{validationMessage}</p> : null}

            <div className='button-row'>
                <button type='button' className='secondary-button' onClick={onReset}>
                    Reset
                </button>
            </div>
        </section>
    )
}

export default ControlPanel
