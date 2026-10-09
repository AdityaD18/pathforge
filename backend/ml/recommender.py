"""Content representation for learning resources: TF-IDF + cosine similarity.

The index is built from each resource's title, description, tags and topic name.
It is deterministic and cheap (≈100 documents), so it is rebuilt at API start-up
rather than persisted.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .catalog import Catalog, Resource


def resource_document(resource: Resource, topic_name: str) -> str:
    tags = " ".join(resource.tags)
    # Tags are curated keywords, so they are repeated to give them more weight than prose.
    return f"{resource.title}. {resource.description} {tags} {tags} {topic_name}"


@dataclass
class ContentIndex:
    vectorizer: TfidfVectorizer
    matrix: csr_matrix
    resource_ids: list[str]

    @classmethod
    def build(cls, catalog: Catalog) -> "ContentIndex":
        ids = sorted(catalog.resources)
        docs = [resource_document(catalog.resources[i], catalog.topics[catalog.resources[i].topic].name) for i in ids]
        vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english", min_df=1,
                              token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z0-9+#.\-]*[a-zA-Z0-9+#]\b|\b[a-zA-Z]\b")
        matrix = vec.fit_transform(docs)
        return cls(vec, matrix.tocsr(), ids)

    def position(self, resource_id: str) -> int:
        return self.resource_ids.index(resource_id)

    def query_vector(self, text: str) -> csr_matrix:
        return self.vectorizer.transform([text])

    def similarity(self, text: str) -> np.ndarray:
        """Cosine similarity between a free-text query and every resource (aligned with resource_ids)."""
        return cosine_similarity(self.query_vector(text), self.matrix).ravel()

    def shared_terms(self, text: str, resource_id: str, top: int = 5) -> list[dict]:
        """Terms that contribute most to the query–resource cosine similarity (the explanation)."""
        q = self.query_vector(text)
        d = self.matrix[self.position(resource_id)]
        contrib = q.multiply(d)
        if contrib.nnz == 0:
            return []
        vocab = self.vectorizer.get_feature_names_out()
        coo = contrib.tocoo()
        pairs = sorted(zip(coo.col, coo.data), key=lambda p: -p[1])[:top]
        total = contrib.sum()
        return [{"term": str(vocab[c]), "share": float(v / total)} for c, v in pairs]
