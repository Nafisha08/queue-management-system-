# Universal Queue Management System

A comprehensive, scalable queue management system for handling project queuing, prioritization, and workflow management across different domains.

## 🚀 Features

### Core Queue Management
- **Multiple Queue Types**: FIFO, LIFO, Priority-based, Weighted, Round Robin, and Custom algorithms
- **Dynamic Prioritization**: Intelligent project ordering based on priority, deadlines, and custom rules
- **Flexible Capacity Management**: Configurable queue capacity and concurrency limits
- **Real-time Processing**: Automated project processing with scheduler integration

### Project Management
- **Comprehensive Project Tracking**: Full lifecycle management from creation to completion
- **Progress Monitoring**: Milestone tracking, progress percentage, and status updates
- **Dependency Management**: Support for project dependencies and relationships
- **Resource Management**: CPU, memory, storage, and custom resource allocation

### User Management & Access Control
- **Role-based Access Control**: Admin, Manager, Worker, and Viewer roles
- **Fine-grained Permissions**: Customizable permissions for different operations
- **User Workload Management**: Automatic workload balancing and capacity management
- **API Key Management**: Secure API access with permission-based keys

### Analytics & Reporting
- **Real-time Dashboard**: Comprehensive overview of projects, queues, and user performance
- **Advanced Analytics**: Project completion trends, queue utilization, and user performance metrics
- **Department Analytics**: Team and department-level performance tracking
- **Custom Reports**: Flexible reporting with date ranges and filtering options

### Automation & Scheduling
- **Automated Processing**: Smart queue processing based on rules and priorities
- **Scheduled Tasks**: Cron-based scheduling for queue processing and maintenance
- **Auto-assignment**: Intelligent project assignment to available workers
- **Notification System**: Automated alerts for overdue projects and queue events

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Validation**: Joi schema validation
- **Logging**: Winston logging system
- **Scheduling**: Node-cron for automated tasks
- **Security**: Helmet.js for security headers, CORS support

## 📁 Project Structure

```
queue-management-system/
├── src/
│   ├── config/
│   │   └── database.js           # Database connection configuration
│   ├── controllers/
│   │   └── projectController.js  # Project-related request handlers
│   ├── middleware/
│   │   ├── auth.js              # Authentication middleware
│   │   ├── errorHandler.js      # Global error handling
│   │   └── validation.js        # Request validation schemas
│   ├── models/
│   │   ├── Project.js           # Project data model
│   │   ├── Queue.js             # Queue data model
│   │   └── User.js              # User data model
│   ├── routes/
│   │   ├── projectRoutes.js     # Project API routes
│   │   ├── queueRoutes.js       # Queue API routes
│   │   ├── userRoutes.js        # User API routes
│   │   └── dashboardRoutes.js   # Dashboard API routes
│   ├── services/
│   │   ├── queueService.js      # Queue business logic
│   │   └── scheduler.js         # Automated task scheduler
│   ├── utils/
│   │   └── logger.js            # Winston logger configuration
│   └── index.js                 # Application entry point
├── tests/                       # Test files
├── docs/                        # Documentation
├── config/                      # Configuration files
├── .env.example                 # Environment variables template
├── package.json                 # Project dependencies and scripts
└── README.md                    # Project documentation
```

## 🚦 Getting Started

### Prerequisites

- Node.js (>= 14.0.0)
- MongoDB (>= 4.4)
- npm (>= 6.0.0)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/queue-management-system.git
   cd queue-management-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/queue_management_db
   
   # Security
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=7d
   BCRYPT_ROUNDS=12
   ```

4. **Start the application**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the application**
   - API Base URL: `http://localhost:3000/api/v1`
   - Health Check: `http://localhost:3000/health`

## 📚 API Documentation

### Authentication

All API endpoints (except registration and login) require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Users
- `POST /api/v1/users/register` - Register a new user
- `POST /api/v1/users/login` - User login
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update user profile
- `GET /api/v1/users` - Get all users (Admin/Manager)

#### Projects
- `GET /api/v1/projects` - Get projects with filtering and pagination
- `POST /api/v1/projects` - Create a new project
- `GET /api/v1/projects/:id` - Get project details
- `PUT /api/v1/projects/:id` - Update project
- `DELETE /api/v1/projects/:id` - Delete project
- `POST /api/v1/projects/:id/queue` - Add project to queue
- `PUT /api/v1/projects/:id/progress` - Update project progress

#### Queues
- `GET /api/v1/queues` - Get user's accessible queues
- `POST /api/v1/queues` - Create a new queue
- `GET /api/v1/queues/:id` - Get queue details
- `PUT /api/v1/queues/:id` - Update queue configuration
- `GET /api/v1/queues/:id/stats` - Get queue statistics
- `POST /api/v1/queues/:id/pause` - Pause queue processing
- `POST /api/v1/queues/:id/resume` - Resume queue processing

#### Dashboard
- `GET /api/v1/dashboard` - Get dashboard overview
- `GET /api/v1/dashboard/projects/analytics` - Project analytics
- `GET /api/v1/dashboard/queues/analytics` - Queue analytics (Manager/Admin)
- `GET /api/v1/dashboard/users/analytics` - User performance analytics (Admin)

### Example API Usage

#### Creating a Project
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Website Redesign",
    "description": "Complete overhaul of company website",
    "category": "development",
    "priority": 8,
    "estimatedDuration": {
      "weeks": 2
    },
    "deadline": "2024-03-15T00:00:00Z",
    "tags": ["web", "frontend", "urgent"]
  }'
```

#### Creating a Queue
```bash
curl -X POST http://localhost:3000/api/v1/queues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Development Queue",
    "description": "Queue for development projects",
    "type": "priority",
    "capacity": 100,
    "concurrency": 3,
    "processingRules": {
      "autoAssign": true,
      "autoStart": true
    },
    "acceptanceCriteria": {
      "categories": ["development", "testing"],
      "minPriority": 3
    }
  }'
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/queue_management_db` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |
| `DEFAULT_QUEUE_CAPACITY` | Default queue capacity | `1000` |
| `MAX_PRIORITY_LEVEL` | Maximum priority level | `10` |
| `SCHEDULER_ENABLED` | Enable automated scheduler | `true` |

### Queue Types

1. **FIFO** - First In, First Out
2. **LIFO** - Last In, First Out (Stack)
3. **Priority** - Based on project priority
4. **Weighted** - Weighted priority calculation
5. **Round Robin** - Cyclic processing
6. **Custom** - User-defined algorithms

### User Roles

1. **Admin** - Full system access
2. **Manager** - Team management and queue creation
3. **Worker** - Project execution and updates
4. **Viewer** - Read-only access

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📊 Monitoring

### Health Check
The system provides a health check endpoint at `/health`:

```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.123,
  "environment": "development",
  "version": "1.0.0"
}
```

### Logging
The system uses Winston for structured logging:
- **Error logs**: `logs/error.log`
- **Combined logs**: `logs/combined.log`
- **Console output**: Development mode only

### Metrics
Built-in metrics include:
- Queue utilization rates
- Project completion rates
- User performance statistics
- System resource usage
- Processing throughput

## 🚀 Deployment

### Docker Deployment

1. **Build the image**
   ```bash
   docker build -t queue-management-system .
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Production Considerations

1. **Environment Configuration**
   - Set `NODE_ENV=production`
   - Use strong JWT secrets
   - Configure proper database credentials
   - Set up SSL/TLS certificates

2. **Security**
   - Enable HTTPS
   - Configure CORS properly
   - Set up rate limiting
   - Use environment-specific secrets

3. **Monitoring**
   - Set up application monitoring
   - Configure log aggregation
   - Monitor database performance
   - Set up alerts for critical metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔮 Roadmap

- [ ] Web-based UI dashboard
- [ ] Real-time WebSocket notifications
- [ ] Advanced reporting and exports
- [ ] Integration with external systems (Jira, Slack, etc.)
- [ ] Machine learning-based project time estimation
- [ ] Multi-tenant support
- [ ] Advanced workflow automation
- [ ] Mobile application support

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in the `docs/` folder
- Review the API examples and test cases

## 🙏 Acknowledgments

- Built with Node.js and Express.js
- Uses MongoDB for data persistence
- Inspired by modern queue management systems
- Thanks to the open-source community for the amazing tools
