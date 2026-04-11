import { Link } from 'react-router-dom';

const LINKS = {
  'Quick Links': [
    { label: 'All Products',       to: '/products' },
    { label: 'Writing Instruments', to: '/products?category=Writing+Instruments' },
    { label: 'Notebooks',           to: '/products?category=Notebooks+%26+Diaries' },
    { label: 'Art & Craft',         to: '/products?category=Art+%26+Craft' },
  ],
  'Customer': [
    { label: 'My Account',   to: '/profile' },
    { label: 'My Orders',    to: '/orders' },
    { label: 'Track Order',  to: '/orders' },
    { label: 'Returns',      to: '/' },
  ],
  'Help': [
    { label: 'FAQ',          to: '/' },
    { label: 'Shipping Info', to: '/' },
    { label: 'Bulk Orders',  to: '/' },
    { label: 'Contact Us',   to: '/' },
  ],
};

export default function Footer() {
  return (
    <footer style={{ background: '#1C1C1C', color: '#999', marginTop: '2rem' }}>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex flex-col items-start gap-1.5 mb-4">
              <img src="/ppw-logo.png" alt="PPW Logo" className="h-12 object-contain filter brightness-[0.8] contrast-125" />
              <span className="text-[11px] font-extrabold tracking-widest uppercase text-white/90">Purbanchal Papers & Works</span>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: '#666' }}>
              Your one-stop destination for quality stationery — for students, artists and offices across India.
            </p>
            <div className="flex gap-2">
              {['📘', '🐦', '📸', '▶️'].map((e, i) => (
                <a key={i} href="#"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {e}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-white">{heading}</h4>
              <ul className="space-y-2">
                {links.map(l => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm transition-colors hover:text-white" style={{ color: '#666' }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: '#444' }}>
            © {new Date().getFullYear()} PPWStore — ABS Technologies. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: '#444' }}>
            Designed & developed by{' '}
            <a href="https://abstechnologies.co.in" target="_blank" rel="noopener noreferrer"
              className="font-semibold transition-colors hover:text-white" style={{ color: '#0C831F' }}>
              ABS Technologies
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
