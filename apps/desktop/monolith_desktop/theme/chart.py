from dataclasses import dataclass
from types import MappingProxyType

from . import palette as P
from .semantic import COLORS, SchemeName


@dataclass(frozen=True)
class ChartPalette:
    categorical: tuple[str, str, str, str, str, str]
    named: MappingProxyType
    sequential: tuple[str, str, str, str, str]
    diverging: MappingProxyType
    status: MappingProxyType
    grid: str
    axis: str
    label: str


def _categorical(named: MappingProxyType) -> tuple[str, str, str, str, str, str]:
    return (named["indigo"], named["teal"], named["coral"], named["blue"], named["rose"], named["amber"])


def _status(scheme: SchemeName) -> MappingProxyType:
    c = COLORS[scheme]
    return MappingProxyType({
        "success": c["successSolid"], "warning": c["warningSolid"], "danger": c["dangerSolid"], "info": c["infoSolid"],
    })


_LIGHT_NAMED = MappingProxyType({
    "indigo": P.INDIGO[500], "teal": P.TEAL[500], "coral": P.CORAL[500],
    "blue": P.BLUE[500], "rose": P.ROSE[500], "amber": P.AMBER[600],
})
_DARK_NAMED = MappingProxyType({
    "indigo": P.INDIGO[400], "teal": P.TEAL[400], "coral": P.CORAL[400],
    "blue": P.BLUE[400], "rose": P.ROSE[400], "amber": P.AMBER[600],
})

CHART = MappingProxyType({
    "light": ChartPalette(
        categorical=_categorical(_LIGHT_NAMED),
        named=_LIGHT_NAMED,
        sequential=(P.INDIGO[100], P.INDIGO[200], P.INDIGO[300], P.INDIGO[500], P.INDIGO[700]),
        diverging=MappingProxyType({"negative": P.CORAL[500], "neutral": P.GRAY[200], "positive": P.TEAL[500]}),
        status=_status("light"),
        grid=P.GRAY[200],
        axis=P.GRAY[300],
        label=COLORS["light"]["textSecondary"],
    ),
    "dark": ChartPalette(
        categorical=_categorical(_DARK_NAMED),
        named=_DARK_NAMED,
        sequential=(P.INDIGO[900], P.INDIGO[700], P.INDIGO[500], P.INDIGO[400], P.INDIGO[200]),
        diverging=MappingProxyType({"negative": P.CORAL[400], "neutral": P.GRAY[800], "positive": P.TEAL[400]}),
        status=_status("dark"),
        grid=P.GRAY[800],
        axis=P.GRAY[700],
        label=COLORS["dark"]["textSecondary"],
    ),
})


def chart_for(scheme: SchemeName) -> ChartPalette:
    return CHART[scheme]
