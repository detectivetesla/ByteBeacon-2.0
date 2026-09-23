import React from 'react';
import { RouteObject } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout.js';
import { withLazy } from '../components/common/LazyRoute.js';
import { isStorefrontHostname, extractStoreSlugFromHost } from '../config/storefront.config.js';
import { LandingPage } from '../pages/public/LandingPage.js';
import { useParams } from 'react-router-dom';

const OrderTrackingPage = withLazy(() => import('../pages/public/OrderTrackingPage.js'), 'OrderTrackingPage');
const DeveloperPortal = withLazy(() => import('../pages/developer/DeveloperPortal.js'), 'DeveloperPortal');
const UnauthorizedPage = withLazy(() => import('../pages/public/UnauthorizedPage.js'), 'UnauthorizedPage');
const PublicStorefrontPage = withLazy(() => import('../pages/public/PublicStorefrontPage.js'), 'PublicStorefrontPage');
const ApiSolutionsPortalPage = withLazy(() => import('../pages/public/ApiSolutionsPortalPage.js'), 'ApiSolutionsPortalPage');
import { NotFoundPage } from '../pages/public/NotFoundPage.js';

export const DynamicHomeRoute: React.FC = () => {
  if (isStorefrontHostname()) {
    const slug = extractStoreSlugFromHost();
    if (slug) {
      // When accessed on a merchant subdomain (e.g. fastdata.apisolutions.store), render storefront
      return <PublicStorefrontPage />;
    }
    // When accessed on apex/www apisolutions.store, render the dedicated API Solutions customer portal
    return <ApiSolutionsPortalPage />;
  }
  // Otherwise on main platform (bytebeacon.online), render the standard ByteBeacon marketing landing page
  return <LandingPage />;
};

export const DynamicTrackRoute: React.FC = () => {
  if (isStorefrontHostname()) {
    const slug = extractStoreSlugFromHost();
    if (slug) {
      // When accessed on a merchant subdomain (e.g. fastdata.apisolutions.store), render storefront
      return <PublicStorefrontPage />;
    }
  }
  return <OrderTrackingPage />;
};

/**
 * Gateway component for /store routes:
 * If accessed on the main bytebeacon.online domain in production, redirects to apisolutions.store.
 * If no slug is specified and no subdomain slug exists, renders the API Solutions portal.
 */
export const StorefrontGateway: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    // If accessed on the main ByteBeacon domain in production, redirect to the canonical apisolutions.store domain
    if (!isStorefrontHostname(host) && !isLocalhost) {
      const targetUrl = slug
        ? `https://apisolutions.store/store/${slug}`
        : `https://apisolutions.store`;
      window.location.replace(targetUrl);
      return null;
    }
  }

  // If no slug is in the URL and no subdomain slug exists, show the portal search page
  const subSlug = extractStoreSlugFromHost();
  if (!slug && !subSlug) {
    return <ApiSolutionsPortalPage />;
  }

  return <PublicStorefrontPage />;
};

export const publicRoutes: RouteObject[] = [
  // 1. Standalone Customer Storefront Routes (100% Isolated — No SaaS Navbar/Footer)
  {
    path: '/store',
    element: <StorefrontGateway />,
  },
  {
    path: '/store/:slug',
    element: <StorefrontGateway />,
  },
  {
    path: '/store/:slug/:page',
    element: <StorefrontGateway />,
  },
  {
    path: '/portal',
    element: <ApiSolutionsPortalPage />,
  },

  // 2. Main Platform Public Routes (Wrapped in PublicLayout)
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <DynamicHomeRoute />,
      },
      {
        path: '/buy',
        element: <StorefrontGateway />,
      },
      {
        path: '/info',
        element: <StorefrontGateway />,
      },
      {
        path: '/track',
        element: <DynamicTrackRoute />,
      },
      {
        path: '/track/:orderId',
        element: <DynamicTrackRoute />,
      },
      {
        path: '/developer',
        element: <DeveloperPortal />,
      },
      {
        path: '/docs',
        element: <DeveloperPortal />,
      },
      {
        path: '/unauthorized',
        element: <UnauthorizedPage />,
      },
      {
        path: '/about',
        element: <NotFoundPage title="About ByteBeacon" description="Our official Company About page is currently being updated. ByteBeacon delivers secure, instant mobile data and connectivity solutions across Ghana." />,
      },
      {
        path: '/support',
        element: <NotFoundPage title="Help & Support Center" description="Need assistance? Our customer and agent support channels are available 24/7. Connect directly via WhatsApp or return home to track your order." />,
      },
      {
        path: '/terms',
        element: <NotFoundPage title="Terms of Service" description="Our platform terms and conditions are currently being refreshed. For immediate compliance questions, please contact our support team." />,
      },
      {
        path: '/privacy',
        element: <NotFoundPage title="Privacy Policy" description="ByteBeacon maintains strict data confidentiality and cryptographic protection. Our privacy documentation is being updated." />,
      },
      {
        path: '/security',
        element: <NotFoundPage title="Security & Escrow" description="ByteBeacon operates automated transaction escrow, cryptographic hashing, and direct carrier API verification." />,
      },
      {
        path: '/status',
        element: <NotFoundPage title="System Status" description="All carrier dispatch pipelines (MTN, Telecel, AT) and automated wallet settlement systems are currently fully operational." />,
      },
      {
        path: '/404',
        element: <NotFoundPage />,
      },
    ],
  },
];


