# Omegle Clone - Production Ready Video Chat Application

A full-featured, production-ready Omegle-like video chat application built with modern web technologies. Connect with random strangers worldwide through video, audio, and text chat.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-required-blue.svg)

## ✨ Features

### Core Features
- 🎥 **Real-time Video Chat** - WebRTC-based peer-to-peer video streaming
- 💬 **Text Chat** - Instant messaging alongside video
- 🎯 **Interest Matching** - Find people with similar interests
- ⏭️ **Skip Partner** - Instantly connect to next person
- 🔇 **Audio/Video Controls** - Mute/unmute audio and video
- 📊 **Live Statistics** - See active users and sessions

### Advanced Features
- 🔒 **Security** - Rate limiting, input validation, and XSS protection
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🚀 **Scalable Architecture** - Redis-based queue and PostgreSQL logging
- 🔄 **Auto-Reconnection** - Handles network failures gracefully
- 🚨 **Moderation System** - Report inappropriate users
- 📈 **Analytics** - Track sessions, messages, and user behavior
- 🐳 **Docker Ready** - One-command deployment
- 🔐 **SSL Support** - HTTPS with Let's Encrypt

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Socket.io Client (real-time communication)
- Simple-peer (WebRTC wrapper)

**Backend:**
- Node.js 20 with TypeScript
- Express (HTTP server)
- Socket.io (WebSocket server)
- WebRTC signaling

**Database & Cache:**
- PostgreSQL (sessions, reports, analytics)
- Redis (user matching, sessions, rate limiting)

**DevOps:**
- Docker & Docker Compose
- Nginx (reverse proxy, SSL termination)
- Let's Encrypt (SSL certificates)

### System Requirements

**Minimum (Testing/Development):**
- 2 CPU cores
- 4GB RAM
- 20GB storage
- ~100 concurrent users

**Recommended (Production - Hostinger KVM 4):**
- 4 CPU cores
- 16GB RAM
- 200GB NVMe SSD
- ~500 concurrent users

**High Performance (Hostinger KVM 8):**
- 8 CPU cores
- 32GB RAM
- 400GB NVMe SSD
- ~2000 concurrent users

## 🚀 Quick Start

### Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Docker & Docker Compose
- Domain name (for SSL)
- Open ports: 80 (HTTP), 443 (HTTPS), 3000 (Backend API)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd omegle-clone
```

2. **Run setup script:**
```bash
./scripts/setup.sh
```

3. **Configure environment:**
Edit `.env` file with your settings:
```bash
nano .env
```

Update these important values:
- `POSTGRES_PASSWORD` - Strong database password
- `CORS_ORIGIN` - Your domain (e.g., https://yourdomain.com)
- `ALLOWED_ORIGINS` - Same as CORS_ORIGIN
- `DOMAIN` - Your domain name
- `EMAIL` - Your email for SSL certificates

4. **Deploy the application:**
```bash
./scripts/deploy.sh
```

5. **Setup SSL (optional but recommended):**
```bash
./scripts/setup-ssl.sh
```

### Access the Application

- **Without SSL:** http://your-server-ip
- **With SSL:** https://yourdomain.com
- **API Health:** http://your-server-ip:3000/health
- **Statistics:** http://your-server-ip:3000/stats

## 📖 Detailed Documentation

### Project Structure

```
omegle-clone/
├── backend/                 # Backend API server
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Socket.io controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── services/       # Business logic services
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Entry point
│   ├── Dockerfile
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript types
│   │   └── App.tsx         # Main component
│   ├── Dockerfile
│   └── package.json
├── nginx/                  # Nginx configuration
│   └── nginx.conf
├── scripts/                # Deployment scripts
│   ├── setup.sh
│   ├── deploy.sh
│   ├── setup-ssl.sh
│   ├── backup.sh
│   └── restore.sh
├── docker-compose.yml      # Docker services
└── README.md
```

### Environment Variables

#### Backend (.env)
```bash
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=omegle_clone
POSTGRES_USER=omegle_user
POSTGRES_PASSWORD=your_strong_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# CORS
CORS_ORIGIN=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Session
SESSION_TIMEOUT_MS=1800000
MATCHING_TIMEOUT_MS=60000
```

#### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information |
| `/health` | GET | Health check |
| `/stats` | GET | Server statistics |

### Socket.io Events

**Client → Server:**
- `start_search` - Start searching for a match
- `stop_search` - Stop searching
- `skip_partner` - Skip current partner
- `end_chat` - End current chat
- `send_message` - Send text message
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `webrtc_offer` - WebRTC offer
- `webrtc_answer` - WebRTC answer
- `webrtc_ice_candidate` - ICE candidate
- `report_user` - Report user

**Server → Client:**
- `user_joined` - User connected
- `match_found` - Match found
- `match_failed` - No match found
- `receive_message` - New message
- `partner_disconnected` - Partner left
- `error` - Error occurred

## 🔧 Management

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart Services
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart backend
```

### Stop Services
```bash
docker-compose down
```

### Backup Database
```bash
./scripts/backup.sh
```

### Restore Database
```bash
./scripts/restore.sh backups/postgres_20240101_120000.sql.gz
```

### Update Application
```bash
git pull
./scripts/deploy.sh
```

## 🔐 Security Best Practices

1. **Change Default Passwords**
   - Update `POSTGRES_PASSWORD` in `.env`
   - Use strong, unique passwords

2. **Enable SSL/HTTPS**
   - Run `./scripts/setup-ssl.sh`
   - Certificates auto-renew via cron

3. **Firewall Configuration**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

4. **Regular Updates**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

5. **Monitor Logs**
   - Check logs regularly for suspicious activity
   - Set up log rotation

6. **Rate Limiting**
   - Configured by default
   - Adjust in backend/.env if needed

## 📊 Monitoring

### Check System Health
```bash
curl http://localhost:3000/health
```

### Get Statistics
```bash
curl http://localhost:3000/stats
```

### Database Queries
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U omegle_user omegle_clone

# Example queries
SELECT COUNT(*) FROM sessions;
SELECT COUNT(*) FROM reports WHERE resolved = false;
```

### Redis Monitoring
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Check keys
KEYS *
INFO
```

## 🐛 Troubleshooting

### Application won't start
1. Check Docker is running: `docker ps`
2. Check logs: `docker-compose logs`
3. Verify ports are available: `netstat -tulpn | grep -E '(80|443|3000|5432|6379)'`

### WebRTC connection fails
1. Check STUN/TURN server configuration
2. Verify firewall allows WebRTC ports
3. Test with different browsers

### Database connection errors
1. Check PostgreSQL is running: `docker-compose ps postgres`
2. Verify credentials in `.env`
3. Check logs: `docker-compose logs postgres`

### High memory usage
1. Limit Redis memory: Edit docker-compose.yml
2. Check for memory leaks: Monitor logs
3. Scale to multiple servers if needed

## 🚀 Performance Optimization

### For High Traffic

1. **Horizontal Scaling**
   - Deploy multiple backend instances
   - Use load balancer (Nginx)
   - Redis Cluster for distributed cache

2. **Database Optimization**
   - Enable connection pooling
   - Add database indexes
   - Use read replicas

3. **CDN Integration**
   - Serve static assets via CDN
   - Cloudflare for DDoS protection

4. **Monitoring**
   - Prometheus + Grafana
   - Application Performance Monitoring (APM)

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check the documentation

## 🎯 Roadmap

- [ ] Mobile apps (iOS/Android)
- [ ] Group video chat
- [ ] Screen sharing
- [ ] Chat history (optional)
- [ ] Language filters
- [ ] Geographic matching
- [ ] Verified accounts
- [ ] Premium features

## ⚠️ Disclaimer

This application is for educational purposes. Users are responsible for:
- Complying with local laws and regulations
- Moderating content appropriately
- Protecting user privacy
- Handling reported content

---

**Built with ❤️ for the open-source community**
