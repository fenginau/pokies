function slugifyLabel(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'option';
}

export function createMachineOption(option, index) {
  const displayLabel = option.displayLabel || option.label;
  const idBase = option.id || slugifyLabel(option.label);

  return {
    id: `${idBase}-${index}`,
    avatarSrc: option.avatarSrc || null,
    label: option.label,
    displayLabel,
  };
}

export function parseOptions(input) {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) =>
      createMachineOption(
        {
          label,
          displayLabel: label,
        },
        index,
      ),
    );
}

export function clampDrawCount(drawCount, optionCount) {
  if (!optionCount) {
    return 1;
  }

  const numericCount = Number(drawCount);
  if (!Number.isFinite(numericCount) || numericCount < 1) {
    return 1;
  }

  return Math.min(optionCount, Math.max(1, Math.floor(numericCount)));
}

export function shuffle(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function chooseResults(options, drawCount) {
  return shuffle(options).slice(0, drawCount);
}

export function sleep(delay) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}
