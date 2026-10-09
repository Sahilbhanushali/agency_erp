import React from 'react';

interface PostAssignedProps {
  post: {
    title: string;
    project: {
      name: string;
    };
    type: string;
    platforms: { platform: string }[];
  };
  designerName: string;
}

export const PostAssigned: React.FC<PostAssignedProps> = ({ post, designerName }) => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#333' }}>New Post Assignment</h1>
      <p>Dear {designerName},</p>
      <p>You have been assigned a new post:</p>
      <ul>
        <li><strong>Title:</strong> {post.title}</li>
        <li><strong>Project:</strong> {post.project.name}</li>
        <li><strong>Type:</strong> {post.type}</li>
        <li><strong>Platforms:</strong> {post.platforms.map(p => p.platform).join(', ')}</li>
      </ul>
      <p>Please check your dashboard for more details.</p>
      <p>Best regards,<br />Your Team</p>
    </div>
  );
};