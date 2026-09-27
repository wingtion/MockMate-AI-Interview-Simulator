import { Link } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import '../App.css';

function NotFound() {
    return (
        <main className="page notfound">
            <div className="notfound-card fade-in">
                <div className="notfound-code" aria-hidden="true">404</div>
                <h1>Page not found</h1>
                <p>The page you're looking for doesn't exist or may have moved.</p>
                <div className="notfound-actions">
                    <Link to="/" className="btn btn-secondary btn-lg">
                        <ArrowLeft size={18} aria-hidden="true" /> Back home
                    </Link>
                    <Link to="/interview/Standard" className="btn btn-primary btn-lg">
                        Start interview
                    </Link>
                </div>
            </div>
        </main>
    );
}

export default NotFound;
