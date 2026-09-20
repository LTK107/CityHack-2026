import { useEffect, useState } from 'react';
import GuideChat from './GuideChat.jsx';
import { formatCost, formatDistance, formatDuration } from '../format.js';

function Facts({ site }) {
  const rows = [
    ['Address', site.address],
    ['Admission', formatCost(site)],
    ['Opening hours', site.openingHours],
    ['Typical visit', formatDuration(site.visitDurationMinutes)],
    ['Year built', site.yearBuilt],
    ['Accessibility', site.accessibility],
    ['Distance', formatDistance(site.distanceKm)],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (rows.length === 0) return null;

  return (
    <dl className="facts">
      {rows.map(([label, value]) => (
        <div className="facts__row" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function SiteDetail({ site, guideEnabled, onClose }) {
  const [tab, setTab] = useState('about');

  // A different site starts on its own overview rather than mid-conversation.
  useEffect(() => setTab('about'), [site.id]);

  const scanHref = site.modelUrl ?? null;

  return (
    <aside className="detail">
      <header className="detail__header">
        <div>
          <h2 className="detail__title">{site.name}</h2>
          {site.category && <p className="detail__category">{site.category}</p>}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close details">
          &times;
        </button>
      </header>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'about'}
          className={`tab${tab === 'about' ? ' tab--active' : ''}`}
          onClick={() => setTab('about')}
        >
          About
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'guide'}
          className={`tab${tab === 'guide' ? ' tab--active' : ''}`}
          onClick={() => setTab('guide')}
        >
          Ask the guide
        </button>
      </div>

      <div className="detail__body">
        {tab === 'about' ? (
          <>
            {site.thumbnailUrl && (
              <img className="detail__image" src={site.thumbnailUrl} alt="" loading="lazy" />
            )}

            {site.description ? (
              <p className="detail__text">{site.description}</p>
            ) : (
              site.shortDescription && <p className="detail__text">{site.shortDescription}</p>
            )}

            <Facts site={site} />

            <div className="detail__links">
              {scanHref && (
                <a className="button" href={scanHref} target="_blank" rel="noreferrer">
                  Open 3D scan
                </a>
              )}
              {!scanHref && site.modelId && (
                <span className="tag tag--muted">Scan ID: {site.modelId}</span>
              )}
              {site.website && (
                <a className="button button--ghost" href={site.website} target="_blank" rel="noreferrer">
                  Official site
                </a>
              )}
              {site.hasLocation && (
                <a
                  className="button button--ghost"
                  href={`https://www.openstreetmap.org/?mlat=${site.latitude}&mlon=${site.longitude}#map=18/${site.latitude}/${site.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Directions
                </a>
              )}
            </div>
          </>
        ) : (
          <GuideChat site={site} enabled={guideEnabled} />
        )}
      </div>
    </aside>
  );
}
