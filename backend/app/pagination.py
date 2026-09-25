from dataclasses import dataclass
from typing import Annotated

from fastapi import Query

MAX_PAGE_LIMIT = 500


@dataclass(frozen=True)
class PaginationParams:
    limit: int | None
    offset: int


def get_pagination_params(
    limit: Annotated[int | None, Query(ge=1, le=MAX_PAGE_LIMIT)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginationParams:
    return PaginationParams(limit=limit, offset=offset)
