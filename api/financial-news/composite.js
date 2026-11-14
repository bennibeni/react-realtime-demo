import { financialNews } from '../../server/financial-news.js';
export default function handler(req, res) {
  req.url = '/api/financial-news/composite';
  return financialNews(req, res, () => { res.statusCode = 404; res.end(); });
}
