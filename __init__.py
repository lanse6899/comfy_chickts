# -*- coding: utf-8 -*-
"""
Chick Temporary Save - ComfyUI图片临时存储插件
可以通过拖入、粘贴或上传图片进行临时存储
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from .server import add_routes

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

# Web目录
WEB_DIRECTORY = "./web"

# 版本信息
__version__ = "1.0.0"
__author__ = "Chick Team"
__description__ = "Chick Temporary Save - ComfyUI图片临时存储插件"

print(f"[Chick Temporary Save] v{__version__} - {__description__}")
print(f"[Chick Temporary Save] 正在加载插件...")

# ComfyUI路由注册
try:
    from server import PromptServer
    
    @PromptServer.instance.routes.get('/chick/api/favorites')
    async def get_favorites_route(request):
        from .server import chick_server
        return await chick_server.get_favorites(request)
    
    @PromptServer.instance.routes.post('/chick/api/favorites')
    async def add_favorite_route(request):
        from .server import chick_server
        return await chick_server.add_favorite(request)
    
    @PromptServer.instance.routes.delete('/chick/api/favorites')
    async def delete_favorite_route(request):
        from .server import chick_server
        return await chick_server.delete_favorite(request)
    
    @PromptServer.instance.routes.get('/chick/api/categories')
    async def get_categories_route(request):
        from .server import chick_server
        return await chick_server.get_categories(request)
    
    @PromptServer.instance.routes.post('/chick/api/categories')
    async def add_category_route(request):
        from .server import chick_server
        return await chick_server.add_category(request)
    
    @PromptServer.instance.routes.post('/chick/api/favorites/rename')
    async def rename_favorite_route(request):
        from .server import chick_server
        return await chick_server.rename_favorite(request)
    
    @PromptServer.instance.routes.delete('/chick/api/categories')
    async def delete_category_route(request):
        from .server import chick_server
        return await chick_server.delete_category(request)
    
    @PromptServer.instance.routes.post('/chick/api/metadata')
    async def get_image_metadata_route(request):
        from .server import chick_server
        return await chick_server.get_image_metadata(request)
    
    @PromptServer.instance.routes.get('/chick/api/config')
    async def get_config_route(request):
        from .server import chick_server
        return await chick_server.get_config(request)
    
    @PromptServer.instance.routes.post('/chick/api/config')
    async def save_config_route(request):
        from .server import chick_server
        return await chick_server.save_config(request)
    
    @PromptServer.instance.routes.post('/chick/api/storage/save')
    async def save_images_to_storage_route(request):
        from .server import chick_server
        return await chick_server.save_images_to_storage(request)
    
    @PromptServer.instance.routes.get('/chick/api/storage/load')
    async def load_images_from_storage_route(request):
        from .server import chick_server
        return await chick_server.load_images_from_storage(request)
    
    print("[Chick Temporary Save] 路由注册成功")
except Exception as e:
    print(f"[Chick Temporary Save] 路由注册失败: {e}")
    
    # 备用方式
    def setup_routes(routes):
        """为ComfyUI设置路由"""
        try:
            add_routes(routes)
            print("[Chick Temporary Save] 路由注册成功（备用方式）")
        except Exception as e:
            print(f"[Chick Temporary Save] 路由注册失败: {e}")
    
    __all__.append('setup_routes')
