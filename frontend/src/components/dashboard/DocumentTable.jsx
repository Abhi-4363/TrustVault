import React, { useState } from 'react';
import { 
  FileText, 
  FileCode, 
  FileSpreadsheet, 
  File, 
  MoreVertical, 
  Share2, 
  Download, 
  Info, 
  Search,
  Filter,
  Trash2
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import './DocumentTable.css';

/**
 * Returns an accessible icon according to the file extension
 */
function getFileIcon(type) {
  switch (type.toUpperCase()) {
    case 'PDF':
      return <FileText className="file-icon-pdf" size={18} aria-hidden="true" />;
    case 'DOCX':
    case 'DOC':
      return <FileText className="file-icon-doc" size={18} aria-hidden="true" />;
    case 'XLSX':
    case 'CSV':
      return <FileSpreadsheet className="file-icon-sheet" size={18} aria-hidden="true" />;
    default:
      return <File size={18} aria-hidden="true" />;
  }
}

/**
 * DocumentTable Component
 * Accessible enterprise table with real-time local search and explicit action modal triggers.
 */
export function DocumentTable({ documents = [], onActionSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Filter documents in memory
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType =
      filterType === 'ALL' || doc.fileType.toUpperCase() === filterType.toUpperCase();

    return matchesSearch && matchesType;
  });

  const toggleMenu = (docId) => {
    setActiveMenuId(activeMenuId === docId ? null : docId);
  };

  return (
    <div className="document-table-container">
      <div className="table-header-toolbar">
        <div className="table-title-area">
          <h2 className="table-heading">Recent documents</h2>
          <span className="table-count-badge">
            {filteredDocs.length} {filteredDocs.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        <div className="table-controls">
          <div className="table-search-box">
            <Search size={15} className="search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Filter by name or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="table-search-input"
              aria-label="Filter documents by name or owner"
            />
          </div>

          <div className="table-filter-group">
            <Filter size={15} className="filter-icon" aria-hidden="true" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="table-filter-select"
              aria-label="Filter documents by file extension"
            >
              <option value="ALL">All formats</option>
              <option value="PDF">PDF documents</option>
              <option value="DOCX">Word files (.docx)</option>
              <option value="XLSX">Spreadsheets (.xlsx)</option>
            </select>
          </div>
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No matching documents found"
          description={
            searchQuery || filterType !== 'ALL'
              ? 'Try adjusting your search criteria or format filter to find what you are looking for.'
              : 'You do not have any documents stored in this vault yet. Upload your first confidential file to get started.'
          }
          actionLabel={searchQuery || filterType !== 'ALL' ? 'Clear filters' : 'Upload document'}
          onAction={() => {
            if (searchQuery || filterType !== 'ALL') {
              setSearchQuery('');
              setFilterType('ALL');
            } else {
              onActionSelect('upload', null);
            }
          }}
        />
      ) : (
        <div className="table-responsive-wrapper">
          <table className="enterprise-table" aria-label="Recent documents">
            <thead>
              <tr>
                <th scope="col" className="th-name">Document name</th>
                <th scope="col" className="th-owner">Owner</th>
                <th scope="col" className="th-date">Last updated</th>
                <th scope="col" className="th-access">Access level</th>
                <th scope="col" className="th-actions text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="table-row">
                  <td className="td-name">
                    <div className="document-cell">
                      <div className="doc-icon-container" aria-hidden="true">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="doc-meta">
                        <div className="doc-title-row">
                          <span className="doc-title" title={doc.name}>{doc.name}</span>
                          {doc.isReal && (
                            <span className="doc-vault-pill" title="Persisted in private vault storage">
                              Vault File
                            </span>
                          )}
                        </div>
                        <span className="doc-subtext">
                          {doc.fileType} • {doc.fileSize}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="td-owner">
                    <div className="owner-cell">
                      <span className="avatar-chip" aria-hidden="true">
                        {doc.owner.initials}
                      </span>
                      <span className="owner-name" title={doc.owner.email}>
                        {doc.owner.name}
                      </span>
                    </div>
                  </td>

                  <td className="td-date">
                    <time dateTime={doc.lastUpdated} className="date-text">
                      {doc.formattedDate}
                    </time>
                  </td>

                  <td className="td-access">
                    <StatusBadge status={doc.accessLevel} />
                  </td>

                  <td className="td-actions text-right">
                    <div className="action-buttons-group">
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => onActionSelect('share', doc)}
                        title={`Manage sharing for ${doc.name}`}
                        aria-label={`Share ${doc.name}`}
                      >
                        <Share2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => onActionSelect('download', doc)}
                        title={`Download ${doc.name}`}
                        aria-label={`Download ${doc.name}`}
                      >
                        <Download size={15} />
                      </button>
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => onActionSelect('details', doc)}
                        title={`View security details for ${doc.name}`}
                        aria-label={`Security details for ${doc.name}`}
                      >
                        <Info size={15} />
                      </button>
                      {doc.isReal && (
                        <button
                          type="button"
                          className="row-action-btn row-action-delete"
                          onClick={() => onActionSelect('delete', doc)}
                          title={`Delete ${doc.name}`}
                          aria-label={`Delete ${doc.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
