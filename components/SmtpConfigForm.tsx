'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Mail, Settings, FlaskConical, Eye, EyeOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
interface User {
  id: string | number;
  name: string;
  email: string;
}

interface SmtpDetails {
  id?: number;
  host: string;
  port: number;
  username: string;
  password?: string;
  encryption: string;
  userId?: number; // Add userId to the interface
}

interface SmtpConfigFormProps {
  users: User[]; // List of users for the dropdown
  initialData?: SmtpDetails | null; // Optional initial data for editing
  onSuccess?: () => void;
  onCancel?: () => void; // Added for dialog cancellation
    smtpConfigs?: Array<{
    id: number;
    userId: number;
    host: string;
    port: number;
    username: string;
    password: string;
    encryption: string;
  }>;
}

export default function SmtpConfigForm({ users, initialData, onSuccess, onCancel, smtpConfigs = [] }: SmtpConfigFormProps) {
  const [formData, setFormData] = useState<SmtpDetails>({
    host: initialData?.host || '',
    port: initialData?.port || 587,
    username: initialData?.username || '',
    password: '',
    encryption: initialData?.encryption || 'TLS',
    userId: initialData?.userId || undefined,
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasExistingConfig, setHasExistingConfig] = useState(!!initialData);
  const [showPassword, setShowPassword] = useState(false);
  const [isViewingPassword, setIsViewingPassword] = useState(false);

  // Load existing SMTP configuration if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        host: initialData.host,
        port: initialData.port,
        username: initialData.username,
        password: '', // Don't pre-fill password for security
        encryption: initialData.encryption,
        userId: initialData.userId,
      });
      setHasExistingConfig(true);
    }
  }, [initialData]);

  // Auto-load existing SMTP configuration for selected user
  useEffect(() => {
    if (formData.userId && !initialData && smtpConfigs) {
      const existingConfig = smtpConfigs.find(config => config.userId === formData.userId);
      
      if (existingConfig) {
        setFormData({
          host: existingConfig.host,
          port: existingConfig.port,
          username: existingConfig.username,
          password: existingConfig.password || '',
          encryption: existingConfig.encryption,
          userId: formData.userId,
        });
        setHasExistingConfig(true);
        setMessage({ 
          type: 'success', 
          text: 'Loaded existing configuration for this user. You can update it.' 
        });
        toast.success('Loaded existing configuration for this user.');
      }
    }
  }, [formData.userId, initialData, smtpConfigs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) || 0 : value,
    }));
  };

  const handleUserChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      userId: value ? parseInt(value) : undefined,
    }));
  };

  const handleTestConnection = async () => {
    if (!formData.host || !formData.username || !formData.password || !formData.userId) {
      setMessage({ type: 'error', text: 'Please fill in all required fields, including user selection' });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/smtp-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, testConnection: true }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'SMTP connection test successful!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Connection test failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to test connection' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.host || !formData.username || (!hasExistingConfig && !formData.password) || !formData.userId) {
      setMessage({ type: 'error', text: 'Please fill in all required fields, including user selection' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const submitData = { ...formData } as any;
      // If updating existing config and password is empty, don't send password
      if (hasExistingConfig && !formData.password) {
        delete submitData.password;
      }

      const response = await fetch('/api/smtp-config', {
        method: hasExistingConfig ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'SMTP configuration saved successfully!' });
        setHasExistingConfig(true);
        onSuccess?.();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save SMTP configuration' });
    } finally {
      setLoading(false);
    }
  };

  const commonPorts = {
    TLS: 587,
    SSL: 465,
    NONE: 25,
  } as const;

  return (
    <div className="w-full">

      {message && (
        <div
          className={`mb-4 p-3 rounded-md flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="userId" className="block text-sm font-medium text-foreground mb-1">
              User *
            </label>
            <Select value={formData.userId?.toString() || ''} onValueChange={handleUserChange} required>
              <SelectTrigger aria-label="Select a user" className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <label htmlFor="host" className="block text-sm font-medium text-foreground mb-1">
              SMTP Host *
            </label>
            <input
              type="text"
              id="host"
              name="host"
              value={formData.host}
              onChange={handleInputChange}
              placeholder="smtp.gmail.com"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="port" className="block text-sm font-medium text-foreground mb-1">
              Port *
            </label>
            <input
              type="number"
              id="port"
              name="port"
              value={formData.port}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="encryption" className="block text-sm font-medium text-foreground mb-1">
              Encryption *
            </label>
            <select
              id="encryption"
              name="encryption"
              value={formData.encryption}
              onChange={(e) => {
                handleInputChange(e);
                // Auto-update port based on encryption
                setFormData((prev) => ({
                  ...prev,
                  encryption: e.target.value as 'TLS' | 'SSL' | 'NONE',
                  port: commonPorts[e.target.value as keyof typeof commonPorts],
                }));
              }}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="TLS">TLS</option>
              <option value="SSL">SSL</option>
              <option value="NONE">None</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="min-w-0">
            <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
              Username/Email *
            </label>
            <input
              type="email"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="your-email@example.com"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Password {hasExistingConfig ? '(leave empty to keep current)' : '*'}
            </label>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder={hasExistingConfig && !isViewingPassword ? "••••••••" : "Enter password"}
                className="w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!hasExistingConfig}
              />

              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5 text-muted-foreground" /> : <Eye className="w-5 h-5 text-muted-foreground" />}
              </button>
            </div>
            
            {hasExistingConfig && !isViewingPassword && initialData?.password && (
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, password: initialData.password || '' }));
                  setIsViewingPassword(true);
                  setShowPassword(true);
                }}
                className="mt-1 text-sm text-blue-600 hover:text-blue-700"
              >
                Load current password
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {/* <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !formData.host || !formData.username || !formData.password || !formData.userId}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border text-foreground rounded-md hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FlaskConical className="w-4 h-4" />
            {testing ? 'Testing...' : 'Test Connection'}
          </button> */}

          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            <Settings className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : hasExistingConfig ? 'Update' : 'Save'}
          </Button>

          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>

      {/* <div className="mt-6 p-3 bg-muted/50 rounded-md">
        <h3 className="text-sm font-medium text-foreground mb-2">Common SMTP Settings:</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            <strong>Gmail:</strong> smtp.gmail.com, Port 587 (TLS)
          </div>
          <div>
            <strong>Outlook:</strong> smtp-mail.outlook.com, Port 587 (TLS)
          </div>
          <div>
            <strong>Yahoo:</strong> smtp.mail.yahoo.com, Port 587 (TLS)
          </div>
        </div>
      </div> */}
    </div>
  );
}
