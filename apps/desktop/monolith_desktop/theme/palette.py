from types import MappingProxyType

WHITE = "#ffffff"
BLACK = "#000000"
CANVAS = "#FCFCFB"
NIGHT = "#262624"
INK = "#1F1E1D"
PAPER = "#FAF9F5"

GRAPHITE = MappingProxyType({
    50: "#F5F5F5", 100: "#EDEDED", 200: "#D4D4D4", 300: "#B3B3B3", 400: "#8F8F8F", 500: "#7A7A7A", 600: "#4D4D4D",
    700: "#333333", 750: "#2A2A2A", 800: "#222222", 850: "#1D1D1D", 900: "#161616", 950: "#0D0D0D",
})
STONE = MappingProxyType({
    50: "#FAF9F6", 100: "#F0EEE6", 200: "#E8E6DC", 300: "#DEDBCF", 400: "#A6A39A", 500: "#908D85", 600: "#65645E",
    650: "#5C5B55", 700: "#45443F", 800: "#3A3936", 850: "#30302E", 900: "#1F1E1D", 950: "#141413",
})
CLAY = MappingProxyType({
    50: "#FBF3EF", 100: "#F7E6DE", 200: "#EFCBBB", 300: "#E6A68D", 400: "#E08A6D",
    500: "#D97757", 600: "#C2613F", 700: "#A6492A", 800: "#3F2A22", 900: "#2E221D",
})

PERIWINKLE = MappingProxyType({
    50: "#FAF8FF", 100: "#EFEBFE", 200: "#E3DDFD", 300: "#D7D0FB", 400: "#D0C8F9",
    500: "#C8BFF7", 600: "#A496EE", 700: "#7662DA", 800: "#4633A3", 900: "#261D53",
})
GRAY = MappingProxyType({
    25: "#FCFCFD", 50: "#F8F9FB", 100: "#F0F0F3", 200: "#E0E1E6", 300: "#CDCED6", 400: "#B0B4BA",
    450: "#9C9EA8", 500: "#8B8D98", 550: "#6E7079", 600: "#60646C", 700: "#3E4148", 800: "#2E3135",
    900: "#212225", 950: "#141416",
})
BLUE = MappingProxyType({
    50: "#F3F9FF", 100: "#E6F4FE", 150: "#E3EEFB", 200: "#CDE4FC", 250: "#9CC6F5", 300: "#7FB8FA", 400: "#3F8FE0",
    450: "#4A9BEB", 500: "#3C87F7", 550: "#2C84DB", 600: "#208AEF", 650: "#1F5FA8", 700: "#1567C4", 850: "#1F3450",
    900: "#0D2440",
})
GREEN = MappingProxyType({100: "#E4F8EC", 200: "#C4EDD5", 400: "#3DD68C", 500: "#2BA25F", 700: "#1B7443", 900: "#0F2A1B"})
AMBER = MappingProxyType({
    50: "#FFFAEE", 100: "#FDF3DC", 200: "#F9E2A8", 300: "#F2C55C", 500: "#E0A020",
    600: "#B98200", 700: "#9C6B0E", 800: "#8A5A00", 900: "#2C2109",
})
RED = MappingProxyType({100: "#FDE9E9", 400: "#FF6369", 500: "#E5484D", 600: "#C62A2F", 700: "#AA2429", 900: "#2E1213"})
VIOLET = MappingProxyType({100: "#F0EBFE", 200: "#DDD3FD", 500: "#7C5CFC", 700: "#5A3BD0", 900: "#1F1640"})
INDIGO = MappingProxyType({
    100: "#ECEAFD", 200: "#D4CFFA", 300: "#B3AAF5", 400: "#8A7BEB", 500: "#6A5AE0", 700: "#4535B0", 900: "#1E1850",
})
TEAL = MappingProxyType({
    50: "#F0FBF9", 100: "#DDF5F1", 200: "#B5EAE1", 300: "#7FD6C8", 400: "#1FA595", 500: "#16968A", 700: "#0F6B61", 900: "#0A2E2A",
})
CORAL = MappingProxyType({
    50: "#FFF5F1", 100: "#FDE7DF", 200: "#FBCDBC", 300: "#F4A487", 400: "#E36D45", 500: "#DA6038", 700: "#A8401E", 900: "#3A1A10",
})
PLUM = MappingProxyType({300: "#B66FCB", 500: "#A452BC", 700: "#7A2890"})
NAVY = MappingProxyType({500: "#5B50C6", 950: "#0D0C2B"})
ORCHID = MappingProxyType({300: "#E7AEF8", 500: "#C47BEA"})
YELLOW = MappingProxyType({300: "#FBE25A", 400: "#F2D335", 500: "#EBC92B", 700: "#B08A00"})
ROSE = MappingProxyType({
    50: "#FFF4F8", 100: "#FCE6EF", 200: "#F8C9DB", 300: "#F0A0BF", 400: "#D65C8F", 500: "#D5508A", 700: "#9A2E5C", 900: "#3A1225",
})
TINT = MappingProxyType({
    "clay": MappingProxyType({"light": "#FAF1EC", "dark": "#3A302B"}),
    "lilac": MappingProxyType({"light": "#F4F2F6", "dark": "#33323A"}),
    "slate": MappingProxyType({"light": "#EFF2F5", "dark": "#2E3237"}),
    "wheat": MappingProxyType({"light": "#F8F4E8", "dark": "#36332B"}),
    "sage": MappingProxyType({"light": "#EFF2EB", "dark": "#2E332D"}),
    "blush": MappingProxyType({"light": "#F8EFEF", "dark": "#373031"}),
    "oat": MappingProxyType({"light": "#F0EEE6", "dark": "#353431"}),
})
