interface PostAssignedData {
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
  
  export function renderPostAssignedEmail(data: PostAssignedData): { html: string; text: string } {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">New Post Assignment</h1>
        <p>Dear ${data.designerName},</p>
        <p>You have been assigned a new post:</p>
        <ul>
          <li><strong>Title:</strong> ${data.post.title}</li>
          <li><strong>Project:</strong> ${data.post.project.name}</li>
          <li><strong>Type:</strong> ${data.post.type}</li>
          <li><strong>Platforms:</strong> ${data.post.platforms.map(p => p.platform).join(', ')}</li>
        </ul>
        <p>Please check your dashboard for more details.</p>
        <p>Best regards,<br>Your Team</p>
      </div>
    `;
  
    const textContent = `Dear ${data.designerName},\n\nYou have been assigned a new post:\n- Title: ${data.post.title}\n- Project: ${data.post.project.name}\n- Type: ${data.post.type}\n- Platforms: ${data.post.platforms.map(p => p.platform).join(', ')}\n\nPlease check your dashboard for more details.\n\nBest regards,\nYour Team`;
  
    return {
      html: `<!DOCTYPE html><html><body>${htmlContent}</body></html>`,
      text: textContent,
    };
  }