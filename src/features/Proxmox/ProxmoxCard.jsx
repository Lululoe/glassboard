import { useState, useMemo } from 'react';
import TwoToneBase from '../../components/Shared/TwoToneBase';
import Icon from '../../components/Shared/Icon';
import EmptyState from '../../components/Shared/EmptyState';
import useProxmox from './useProxmox';
import './ProxmoxCard.css';

/**
 * Renders a small horizontal progress bar for resource usage (CPU, RAM, HDD).
 * @param {Object} props
 * @param {string} props.label - Label for the bar (e.g., 'CPU').
 * @param {number} props.value - Percentage value (0-100).
 * @param {string} props.colorClass - CSS class for bar color.
 * @returns {JSX.Element} The rendered progress bar.
 */
const MiniBar = ({ label, value, colorClass }) => {
    // Ensure value is valid
    const safeValue = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));

    return (
        <div className="stat-group">
            <div className="stat-label-row">
                <span>{label}</span>
                <span>{Math.round(safeValue)}%</span>
            </div>
            <div className="mini-bar-container">
                <div className={`mini-bar-fill ${colorClass}`} style={{ width: `${safeValue}%` }} />
            </div>
        </div>
    );
};

/**
 * Renders an individual Proxmox node (VM or LXC) item.
 * @param {Object} props
 * @param {Object} props.node - Proxmox node data object.
 * @returns {JSX.Element} The rendered node item.
 */
const ProxmoxItem = ({ node }) => {
    const isRunning = node.status === 'running';
    const iconName = node.type === 'lxc' ? 'lu-Container' : 'lu-Monitor'; // Container vs Screen

    return (
        <div className="proxmox-item">
            <div className="proxmox-header-row">
                <div className="proxmox-info">
                    <div className="proxmox-icon-circle">
                        <Icon icon={iconName} size={18} />
                    </div>
                    <div>
                        <span className="proxmox-name">{node.name}</span>
                        <span className="proxmox-id">({node.id})</span>
                    </div>
                </div>
                <div className={`proxmox-status-badge ${node.status}`}>
                    {node.status}
                </div>
            </div>

            <div className="proxmox-stats-row">
                <MiniBar label="CPU" value={isRunning ? node.cpu : 0} colorClass="bar-cpu" />
                <MiniBar label="RAM" value={isRunning ? node.ram : 0} colorClass="bar-ram" />
                <MiniBar label="HDD" value={node.disk} colorClass="bar-disk" />
            </div>
        </div>
    );
};

/**
 * ProxmoxCard component displays VM and LXC status with resource usage bars.
 * Supports sorting by ID or Name (ascending/descending).
 * @param {Object} props
 * @param {Object} props.config - Configuration object for the Proxmox card.
 * @returns {JSX.Element} The rendered card.
 */
const ProxmoxCard = ({ config }) => {
    const { nodes, summary } = useProxmox();
    const colSpan = config.colSpan || 1;
    const url = config.url || '';

    const [sortMode, setSortMode] = useState('id-asc');

    // Cycle sort modes: id -> id-desc -> name -> name-desc
    const toggleSort = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSortMode(prev => {
            if (prev === 'id-asc') return 'id-desc';
            if (prev === 'id-desc') return 'name-asc';
            if (prev === 'name-asc') return 'name-desc';
            return 'id-asc';
        });
    };

    const sortedNodes = useMemo(() => {
        const sorted = [...nodes];
        sorted.sort((a, b) => {
            switch (sortMode) {
                case 'id-asc': return a.id - b.id;
                case 'id-desc': return b.id - a.id;
                case 'name-asc': return a.name.localeCompare(b.name);
                case 'name-desc': return b.name.localeCompare(a.name);
                default: return 0;
            }
        });
        return sorted;
    }, [nodes, sortMode]);

    // Determine icon based on current sort
    const sortIconName = useMemo(() => {
        switch (sortMode) {
            case 'id-asc': return 'lu-ArrowDown01';
            case 'id-desc': return 'lu-ArrowUp01';
            case 'name-asc': return 'lu-ArrowDownAZ';
            case 'name-desc': return 'lu-ArrowUpAZ';
            default: return 'lu-ArrowDown01';
        }
    }, [sortMode]);

    const icon = config.icon || "sh-proxmox";
    const iconColor = config.iconColor;
    const iconBackground = config.iconBackground;

    return (
        <TwoToneBase
            colSpan={colSpan}
            title="Proxmox"
            url={url}
            subtitle={
                <>
                    <span><Icon icon="lu-PlayCircle" size={12} /> {summary.running} / {summary.total} Running</span>
                </>
            }
            icon={icon}
            iconColor={iconColor}
            iconBackground={iconBackground}
            actions={
                <div
                    className="two-tone-header-action"
                    onClick={toggleSort}
                    title="Change Sort Order"
                >
                    <Icon icon={sortIconName} size={20} />
                </div>
            }
        >
            <div className="proxmox-list">
                {sortedNodes.length === 0 ? (
                    <EmptyState message="No nodes found" />
                ) : (
                    sortedNodes.map(node => (
                        <ProxmoxItem key={node.id} node={node} />
                    ))
                )}
            </div>
        </TwoToneBase>
    );
};

export default ProxmoxCard;
