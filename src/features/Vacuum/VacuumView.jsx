import { useEffect, useState } from 'react';
import { callService } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';
import { cameraUrl, roomOfSegment } from './vacuumModel';

const MAP_INTERVAL = 5000;
const IMAGE_INTERVAL = 2000;

/**
 * The minimal map drawn from Valetudo's map data: rooms, walls, the path so far, the dock and
 * the robot. Tapping a room that's on the card picks it for cleaning.
 * @param {Object} props
 * @param {Object} props.map - The map from the server.
 * @param {Object} props.robot - The robot.
 * @param {string[]} props.selected - Areas of the picked rooms.
 * @param {(robot: Object, area: string) => void} props.onToggle - Picks or unpicks a room.
 * @returns {JSX.Element} The map.
 */
const ValetudoMap = ({ map, robot, selected, onToggle }) => {
    const [x, y, w, h] = map.viewBox;
    const unit = Math.max(w, h) / 100;
    return (
        <svg className="vac-map" viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Map of ${robot.name}`}>
            {map.floor && <path className="vac-map-floor" d={map.floor} />}
            {map.segments.map(s => {
                const room = roomOfSegment(s, robot.rooms);
                const picked = room && selected.includes(room.area);
                return (
                    <path
                        key={s.id}
                        className={`vac-map-room${room ? ' pickable' : ''}${picked ? ' picked' : ''}`}
                        d={s.d}
                        onClick={room ? () => onToggle(robot, room.area) : undefined}
                    />
                );
            })}
            {map.walls && <path className="vac-map-wall" d={map.walls} />}
            {map.path && <path className="vac-map-path" d={map.path} style={{ strokeWidth: unit * 0.5 }} />}
            {map.segments.filter(s => s.name).map(s => (
                <text key={s.id} className="vac-map-label" x={s.x} y={s.y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: unit * 3.6 }}>{s.name}</text>
            ))}
            {map.charger && <rect className="vac-map-charger" x={map.charger.x - unit * 1.5} y={map.charger.y - unit * 1.5} width={unit * 3} height={unit * 3} rx={unit * 0.6} />}
            {map.robot && (
                <g transform={`translate(${map.robot.x} ${map.robot.y})`}>
                    {robot.state === 'cleaning' && <circle className="vac-map-pulse" r={unit * 3.6} />}
                    <circle className="vac-map-robot" r={unit * 2} style={{ strokeWidth: unit * 0.7 }} />
                </g>
            )}
        </svg>
    );
};

/**
 * What a robot's camera or map entity shows: Valetudo's camera becomes a minimal map, and any
 * other camera its picture, refreshed every few seconds.
 * @param {Object} props
 * @param {*} props.cardId - The card, which the server checks the camera against.
 * @param {string} props.entityId - The camera entity.
 * @param {Object} props.robot - The robot.
 * @param {string[]} props.selected - Areas of the picked rooms.
 * @param {(robot: Object, area: string) => void} props.onToggle - Picks or unpicks a room.
 * @returns {JSX.Element} The view.
 */
const VacuumView = ({ cardId, entityId, robot, selected, onToggle }) => {
    // Polling stays cheap for plain cameras: the server remembers that they aren't maps
    const { data, error } = usePolling(
        () => callService('homeassistant', { endpoint: 'vacuum_map', card_id: cardId, entity_id: entityId }),
        { interval: MAP_INTERVAL, key: `${cardId}|${entityId}` },
    );
    const [tick, setTick] = useState(0);
    const [broken, setBroken] = useState(false);
    const image = data?.kind === 'image';

    useEffect(() => {
        if (!image) return undefined;
        const timer = setInterval(() => setTick(t => t + 1), IMAGE_INTERVAL);
        return () => clearInterval(timer);
    }, [image]);

    if (data?.kind === 'valetudo') return <ValetudoMap map={data} robot={robot} selected={selected} onToggle={onToggle} />;
    if (image && !broken) {
        return <img className="vac-camera" src={cameraUrl(cardId, entityId, tick)} alt={`Picture from ${entityId}`} onError={() => setBroken(true)} onLoad={() => setBroken(false)} />;
    }
    return <div className="vac-view-message">{image || error ? 'Camera unavailable' : 'Loading…'}</div>;
};

export default VacuumView;
