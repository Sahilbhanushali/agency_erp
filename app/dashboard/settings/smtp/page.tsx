'use client';
import { useState, useEffect } from 'react';
import SmtpConfigForm from '@/components/SmtpConfigForm';
import { AlertCircle, CheckCircle, Mail, Trash2, RefreshCw } from 'lucide-react';

interface SmtpConfig {
  id: number;
  userId: number;
  host: string;
  port: number;
  username: string;
  encryption: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SmtpSettingsPage() {
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SmtpConfig | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);

  // Fetch SMTP configurations
  const fetchSmtpConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/smtp-config', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch SMTP configurations');
      }
      const data = await response.json();
      setSmtpConfigs(data.configs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSmtpConfigs();
  }, []);

  // Handle form submission
  const handleFormSubmit = async (formData: any) => {
    try {
      const url = editingConfig ? '/api/smtp-config' : '/api/smtp-config';
      const method = editingConfig ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ...(editingConfig && { id: editingConfig.id }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save SMTP configuration');
      }

      await fetchSmtpConfigs();
      setShowForm(false);
      setEditingConfig(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // Handle delete configuration
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this SMTP configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/smtp-config?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete SMTP configuration');
      }

      await fetchSmtpConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // Test SMTP connection
  const testConnection = async (config: SmtpConfig) => {
    try {
      setTestingConnection(config.id);
      const response = await fetch('/api/smtp-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...config, testConnection: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Connection test failed');
      }

      const result = await response.json();
      alert(result.success ? 'Connection test successful!' : 'Connection test failed!');
      await fetchSmtpConfigs(); // Refresh to update isVerified status
    } catch (err) {
      alert('Connection test failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setTestingConnection(null);
    }
  };

  // Set active configuration
  const setActiveConfig = async (id: number) => {
    try {
      // Deactivate all other configurations
      await prisma.smtpDetails.updateMany({
        where: { userId: smtpConfigs[0].userId },
        data: { isActive: false },
      });

      // Activate the selected configuration
      await prisma.smtpDetails.update({
        where: { id },
        data: { isActive: true },
      });

      await fetchSmtpConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error === 'Forbidden: Admin access required') {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">You do not have permission to access this page.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SMTP Settings</h1>
        <p className="text-gray-600">
          Configure SMTP servers for sending emails from your application.
        </p>
      </div>

      {error && error !== 'Forbidden: Admin access required' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Add New Configuration Button */}
      <div className="mb-6">
        <button
          onClick={() => {
            setShowForm(true);
            setEditingConfig(null);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Mail className="h-4 w-4 mr-2" />
          Add SMTP Configuration
        </button>
      </div>

      {/* SMTP Configurations List */}
      <div className="space-y-4">
        {smtpConfigs.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No SMTP configurations found
            </h3>
            <p className="text-gray-600 mb-4">
              Add your first SMTP configuration to start sending emails.
            </p>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingConfig(null);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Add Configuration
            </button>
          </div>
        ) : (
          smtpConfigs.map((config) => (
            <div
              key={config.id}
              className={`bg-white border rounded-lg p-6 ${
                config.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {config.host}:{config.port}
                    </h3>
                    {config.isActive && (
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        Active
                      </span>
                    )}
                    {config.isVerified ? (
                      <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="ml-2 h-4 w-4 text-yellow-500" />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Username:</span> {config.username}
                    </div>
                    <div>
                      <span className="font-medium">Encryption:</span> {config.encryption}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      {config.isVerified ? 'Verified' : 'Unverified'}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Created: {new Date(config.createdAt).toLocaleDateString('en-GB')}
                    {config.updatedAt !== config.createdAt && (
                      <span className="ml-4">
                        Updated: {new Date(config.updatedAt).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  {!config.isActive && (
                    <button
                      onClick={() => setActiveConfig(config.id)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => testConnection(config)}
                    disabled={testingConnection === config.id}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Test Connection"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        testingConnection === config.id ? 'animate-spin' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setEditingConfig(config);
                      setShowForm(true);
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete Configuration"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SMTP Configuration Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingConfig ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingConfig(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <SmtpConfigForm
              initialData={editingConfig}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingConfig(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}