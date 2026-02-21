# xems-server-test

XyPriss project: xems-server-test

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev
```

The server will start on `http://localhost:8080` with hot reload and TypeScript compilation enabled.

### Production

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
├── src/
│   ├── server.ts          # Main server entry point
│   ├── _sys/              # System configuration
│   ├── configs/           # Server configuration
│   ├── middleware/        # Custom middleware
│   ├── routes/            # API routes
│   └── schema/            # Validation schemas
├── package.json           # Dependencies and scripts
├── quickdev.config.json   # Development server config
├── xypriss.config.json    # XyPriss framework config
└── tsconfig.json          # TypeScript configuration
```

## 🛠️ Features



- **Type Safety**: Full TypeScript support with strict type checking
- **High Performance**: Built on XyPriss framework with optimized performance
- **Hot Reload**: Development server with automatic reloading and TypeScript compilation
- **Security**: Built-in security middleware and protections
- **Validation**: Request validation with Fortify Schema and TypeScript types
- **File Upload**: Support for multipart file uploads with type safety
- **Caching**: Memory-based caching for improved performance

## 📚 API Endpoints

### Health Check

- `GET /health` - Server health status
- `GET /api/status` - API status information

### User Management (Example)

- `GET /api/users` - List users
- `POST /api/users` - Create user

### File Upload (Example)

- `POST /api/upload` - Upload files

### Validation (Example)

- `POST /api/validate` - Validate input data

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=8080
NODE_ENV=development
```

### Server Configuration

Edit `src/configs/xypriss.config.ts` to customize:

- Server port and host
- Security settings
- Performance options
- File upload limits
- Caching configuration

## 🧪 Development

### Adding Routes

Edit `src/routes/index.ts`:

```typescript
// Add new routes with type safety
router.get("/api/new-endpoint", (req: Request, res: Response) => {
  res.json({ message: "New endpoint" });
});
```

### Adding Middleware

Edit `src/middleware/index.ts`:

```typescript
// Add custom middleware with proper typing
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

### Validation

Use Fortify Schema for request validation with TypeScript:

```typescript
import { Interface } from "fortify-schema";

const userSchema = Interface({
  username: "username",
  email: "email",
  password: "password",
});

// Use in routes with type safety
router.post(
  "/api/users",
  validateBody(userSchema),
  (req: Request, res: Response) => {
    // Request is validated and typed
    const userData = req.body; // Fully typed
    res.json({ success: true, user: userData });
  }
);
```

## 📦 Dependencies

### Runtime Dependencies

- `xypriss` - Main framework
- `xypriss-security` - Security utilities
- `fortify-schema` - Validation library
- `StrulLink` - URI processing
- `nquickdev` - Development server

### Development Dependencies

- `typescript` - TypeScript compiler
- `@types/node` - Node.js type definitions
- `bun` - Fast JavaScript runtime
- `prisma` - Database toolkit

## 🚀 Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build
EXPOSE 8080

CMD ["npm", "start"]
```

### PM2

```bash
npm install -g pm2
pm2 start dist/server.js --name "xypriss-app"
```

## 🔧 TypeScript Configuration

The project includes a comprehensive `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper TypeScript types
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- [XyPriss Documentation](https://github.com/Nehonix-Team/XyPriss)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [GitHub Issues](https://github.com/Nehonix-Team/XyPriss/issues)

---

Built with ❤️ using [XyPriss Framework](https://github.com/Nehonix-Team/XyPriss) and TypeScript
