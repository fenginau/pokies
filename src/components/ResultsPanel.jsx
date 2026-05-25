function ResultsPanel({ results, requestedCount, status }) {
  return (
    <section className="panel results-panel">
      <div className="panel-heading">
        <h2>Results</h2>
        <p>{status}</p>
      </div>

      <ol className="results-list">
        {results.map((result, index) => (
          <li key={`${result}-${index}`} className="result-item">
            <span className="result-order">{index + 1}</span>
            <span className="result-value">{result}</span>
          </li>
        ))}
      </ol>

      {!results.length ? (
        <div className="results-empty">Drawn balls will appear here. Target count: {requestedCount}.</div>
      ) : null}
    </section>
  );
}

export default ResultsPanel;
