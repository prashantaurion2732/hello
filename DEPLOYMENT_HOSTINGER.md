# Deployment Guide for Hostinger VPS

This guide will help you deploy the Omegle Clone application on Hostinger VPS.

## 📋 Prerequisites

### What You Need

1. **Hostinger VPS Account**
   - Recommended: KVM 4 or KVM 8 plan
   - Ubuntu 20.04 or 22.04 LTS

2. **Domain Name** (optional but recommended)
   - Can be purchased from Hostinger or any domain registrar
   - DNS configured to point to your VPS IP

3. **SSH Access**
   - SSH key or password for VPS access

## 🎯 Step-by-Step Deployment

### Step 1: Access Your Hostinger VPS

1. **Login to Hostinger hPanel**
   - Go to https://hpanel.hostinger.com
   - Navigate to VPS section

2. **Get your VPS credentials**
   - IP Address
   - SSH Port (usually 22)
   - Root password or SSH key

3. **Connect via SSH**
   ```bash
   ssh root@your-vps-ip
   ```

### Step 2: Update System

```bash
# Update package lists
apt update

# Upgrade installed packages
apt upgrade -y

# Install essential tools
apt install -y curl git wget nano ufw
```

### Step 3: Configure Firewall

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

### Step 4: Install Docker

```bash
# Download Docker installation script
curl -fsSL https://get.docker.com -o get-docker.sh

# Run installation script
sh get-docker.sh

# Remove installation script
rm get-docker.sh

# Start Docker service
systemctl start docker
systemctl enable docker

# Verify installation
docker --version
```

### Step 5: Install Docker Compose

```bash
# Download Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### Step 6: Clone the Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository (replace with your repo URL)
git clone <your-repository-url> omegle-clone

# Navigate to project directory
cd omegle-clone
```

### Step 7: Run Setup Script

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run setup
./scripts/setup.sh
```

### Step 8: Configure Environment Variables

```bash
# Edit main .env file
nano .env
```

**Update the following values:**

```env
# Strong password for PostgreSQL
POSTGRES_PASSWORD=Your_Very_Strong_Password_Here_123!

# Your domain (if you have one)
DOMAIN=yourdomain.com
EMAIL=your-email@example.com

# CORS origins (use your domain or VPS IP)
CORS_ORIGIN=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

**If using IP address instead of domain:**
```env
CORS_ORIGIN=http://YOUR_VPS_IP
ALLOWED_ORIGINS=http://YOUR_VPS_IP
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 9: Deploy the Application

```bash
./scripts/deploy.sh
```

This will:
- Build all Docker images
- Start all services (Backend, Frontend, PostgreSQL, Redis)
- Run health checks

Wait for the deployment to complete (usually 2-5 minutes).

### Step 10: Verify Deployment

```bash
# Check if all services are running
docker-compose ps

# Check backend health
curl http://localhost:3000/health

# Check application stats
curl http://localhost:3000/stats
```

**Expected output:**
- All services should show "Up" status
- Health check should return: `{"status":"healthy",...}`

### Step 11: Access Your Application

**Without SSL (HTTP):**
```
http://YOUR_VPS_IP
```

**With domain (next step for SSL):**
```
https://yourdomain.com
```

## 🔐 Step 12: Setup SSL (HTTPS) - Recommended

### Configure DNS First

1. **Login to your domain registrar**
2. **Add A records:**
   - Type: A
   - Name: @ (or yourdomain.com)
   - Value: YOUR_VPS_IP
   - TTL: 3600

   - Type: A
   - Name: www
   - Value: YOUR_VPS_IP
   - TTL: 3600

3. **Wait for DNS propagation** (5 minutes to 48 hours)
   ```bash
   # Check if DNS is propagated
   nslookup yourdomain.com
   ```

### Install SSL Certificate

```bash
# Run SSL setup script
./scripts/setup-ssl.sh
```

This will:
- Install certbot
- Obtain SSL certificate from Let's Encrypt
- Configure Nginx with SSL
- Restart services with HTTPS

**Your site will now be available at:**
- https://yourdomain.com
- https://www.yourdomain.com

### Setup Auto-Renewal

```bash
# Edit crontab
crontab -e

# Add this line to auto-renew certificates monthly
0 0 1 * * certbot renew --quiet && cd /root/omegle-clone && docker-compose restart nginx
```

## 📊 Hostinger Plan Recommendations

### KVM 1 ($4.99/month) - NOT RECOMMENDED
- 1 vCPU, 4GB RAM
- Only for testing/development
- Max ~50 concurrent users

### KVM 2 ($6.99/month) - MINIMAL
- 2 vCPU, 8GB RAM
- Small deployment
- Max ~100 concurrent users

### KVM 4 ($9.99/month) - RECOMMENDED ⭐
- 4 vCPU, 16GB RAM
- Production ready
- Max ~500 concurrent users
- **Best value for money**

### KVM 8 ($19.99/month) - HIGH PERFORMANCE
- 8 vCPU, 32GB RAM
- Large scale deployment
- Max ~2000 concurrent users
- For serious production use

## 🔧 Performance Tuning for Hostinger

### For KVM 4 (16GB RAM)

Edit `docker-compose.yml`:

```yaml
services:
  redis:
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru

  backend:
    environment:
      - NODE_OPTIONS=--max-old-space-size=4096
```

### For KVM 8 (32GB RAM)

```yaml
services:
  redis:
    command: redis-server --maxmemory 4gb --maxmemory-policy allkeys-lru

  backend:
    environment:
      - NODE_OPTIONS=--max-old-space-size=8192
```

Apply changes:
```bash
docker-compose down
docker-compose up -d
```

## 📈 Monitoring & Maintenance

### Check Server Resources

```bash
# CPU and Memory usage
htop

# Disk usage
df -h

# Docker stats
docker stats
```

### View Application Logs

```bash
# All logs
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100
```

### Backup Your Data

```bash
# Create backup
./scripts/backup.sh

# Backups are stored in ./backups/
ls -lh backups/
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

## 🚨 Troubleshooting

### Application Not Accessible

1. **Check if services are running:**
   ```bash
   docker-compose ps
   ```

2. **Check firewall:**
   ```bash
   ufw status
   ```

3. **Check Nginx logs:**
   ```bash
   docker-compose logs nginx
   ```

### High Memory Usage

1. **Check Docker stats:**
   ```bash
   docker stats
   ```

2. **Restart Redis to clear cache:**
   ```bash
   docker-compose restart redis
   ```

3. **Consider upgrading to higher plan**

### SSL Certificate Issues

1. **Verify DNS is pointing to your server:**
   ```bash
   nslookup yourdomain.com
   ```

2. **Check certbot logs:**
   ```bash
   sudo cat /var/log/letsencrypt/letsencrypt.log
   ```

3. **Manually renew certificate:**
   ```bash
   sudo certbot renew --force-renewal
   ```

### WebRTC Connection Issues

1. **Check browser console for errors**
2. **Try different browser**
3. **Ensure HTTPS is enabled** (required for WebRTC on most browsers)

## 💰 Cost Breakdown

### KVM 4 Plan (Recommended)

**Monthly Costs:**
- VPS: $9.99/month
- Domain: $1-2/month (optional)
- SSL: FREE (Let's Encrypt)
- **Total: ~$11-12/month**

**Annual Costs:**
- First year (with 70% discount): ~$48-60/year
- Renewal: ~$132-144/year

### Scaling Considerations

**If you outgrow KVM 4:**
1. Upgrade to KVM 8 ($19.99/month)
2. Add Cloudflare CDN (free tier)
3. Multiple VPS instances with load balancer
4. Migrate to cloud (AWS/GCP) for auto-scaling

## ✅ Post-Deployment Checklist

- [ ] Application accessible via HTTP
- [ ] All Docker services running
- [ ] Database connection working
- [ ] Redis cache working
- [ ] SSL certificate installed (if using domain)
- [ ] DNS pointing to VPS
- [ ] Firewall configured
- [ ] Auto-renewal cron job set
- [ ] Backup script tested
- [ ] Monitoring setup
- [ ] Changed default passwords
- [ ] Updated CORS origins

## 📞 Hostinger Support

If you need help with VPS-specific issues:
- Hostinger Support: https://www.hostinger.com/contact
- Live Chat: Available 24/7
- Knowledge Base: https://support.hostinger.com

## 🎉 Success!

Your Omegle Clone is now live! Share your domain with users and start connecting people worldwide.

**Important URLs:**
- Application: https://yourdomain.com
- Health Check: https://yourdomain.com/health
- Statistics: https://yourdomain.com/stats

---

**Need help? Check the main README.md for detailed documentation.**
