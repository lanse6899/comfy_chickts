# -*- coding: utf-8 -*-
"""
Chick Temporary Save服务器路由模块
"""
from pathlib import Path
from aiohttp import web
import json
import time
import base64
import io
from PIL import Image

class ChickServer:
    """Chick Temporary Save服务器"""
    
    def __init__(self):
        self.data_file = Path(__file__).parent / 'favorites.json'
        self.config_file = Path(__file__).parent / 'chick_config.json'
        self.ensure_data_file()
        self.ensure_config_file()
        
        # 获取存储目录
        self.storage_dir = self.get_storage_dir()
    
    def ensure_data_file(self):
        """确保数据文件存在"""
        if not self.data_file.exists():
            default_data = {
                'categories': ['默认分类', '常用节点', '图像处理', '文本处理'],
                'favorites': []
            }
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(default_data, f, ensure_ascii=False, indent=2)
    
    def ensure_config_file(self):
        """确保配置文件存在"""
        if not self.config_file.exists():
            # 默认存储目录：插件目录下的 cache
            default_storage = str(Path(__file__).parent / 'cache')
            default_config = {
                'storage_dir': default_storage,
                'use_file_storage': True  # 默认使用文件系统存储
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
        else:
            # 如果配置文件已存在，检查并更新 use_file_storage 为 True（如果未设置）
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    if 'use_file_storage' not in config or config.get('use_file_storage') is False:
                        config['use_file_storage'] = True
                        config['storage_dir'] = str(Path(__file__).parent / 'cache')
                        with open(self.config_file, 'w', encoding='utf-8') as f:
                            json.dump(config, f, ensure_ascii=False, indent=2)
                        print("[Chick] 已更新配置：启用文件系统存储")
            except Exception as e:
                print(f"[Chick] 更新配置失败: {e}")
    
    def get_storage_dir(self):
        """获取存储目录"""
        # 固定使用 cache 文件夹
        cache_dir = Path(__file__).parent / 'cache'
        cache_dir.mkdir(exist_ok=True)
        return cache_dir
    
    def load_config(self):
        """加载配置"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Chick] 加载配置失败: {e}")
            return {'storage_dir': str(self.storage_dir), 'use_file_storage': False}
    
    def save_config(self, config):
        """保存配置"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            # 更新存储目录
            if 'storage_dir' in config:
                self.storage_dir = Path(config['storage_dir'])
                self.storage_dir.mkdir(parents=True, exist_ok=True)
            return True
        except Exception as e:
            print(f"[Chick] 保存配置失败: {e}")
            return False
    
    def load_data(self):
        """加载数据"""
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Chick Temporary Save] 加载数据失败: {e}")
            return {'categories': ['默认分类'], 'favorites': []}
    
    def save_data(self, data):
        """保存数据"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"[Chick Temporary Save] 保存数据失败: {e}")
            return False
    
    async def get_favorites(self, request):
        """获取收藏列表"""
        try:
            data = self.load_data()
            return web.json_response({
                'success': True,
                'data': data
            })
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def add_favorite(self, request):
        """添加收藏"""
        try:
            body = await request.json()
            node_data = body.get('node')
            category = body.get('category', '默认分类')
            
            if not node_data:
                return web.json_response({
                    'success': False,
                    'error': '缺少节点数据'
                }, status=400)
            
            data = self.load_data()
            
            # 添加时间戳和ID
            node_data['id'] = str(int(time.time() * 1000))
            node_data['category'] = category
            node_data['created_at'] = time.time()
            
            data['favorites'].append(node_data)
            
            if self.save_data(data):
                return web.json_response({
                    'success': True,
                    'data': node_data
                })
            else:
                return web.json_response({
                    'success': False,
                    'error': '保存失败'
                }, status=500)
                
        except Exception as e:
            print(f"[Chick Temporary Save] 添加收藏失败: {e}")
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def delete_favorite(self, request):
        """删除收藏"""
        try:
            node_id = request.query.get('id')
            
            if not node_id:
                return web.json_response({
                    'success': False,
                    'error': '缺少节点ID'
                }, status=400)
            
            data = self.load_data()
            data['favorites'] = [f for f in data['favorites'] if f.get('id') != node_id]
            
            if self.save_data(data):
                return web.json_response({
                    'success': True
                })
            else:
                return web.json_response({
                    'success': False,
                    'error': '保存失败'
                }, status=500)
                
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def get_categories(self, request):
        """获取分类列表"""
        try:
            data = self.load_data()
            return web.json_response({
                'success': True,
                'data': data.get('categories', ['默认分类'])
            })
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def add_category(self, request):
        """添加分类"""
        try:
            body = await request.json()
            category_name = body.get('name')
            
            if not category_name:
                return web.json_response({
                    'success': False,
                    'error': '缺少分类名称'
                }, status=400)
            
            data = self.load_data()
            
            if category_name not in data['categories']:
                data['categories'].append(category_name)
                
                if self.save_data(data):
                    return web.json_response({
                        'success': True,
                        'data': data['categories']
                    })
            
            return web.json_response({
                'success': True,
                'data': data['categories']
            })
                
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def rename_favorite(self, request):
        """重命名收藏"""
        try:
            body = await request.json()
            node_id = body.get('id')
            new_title = body.get('title')
            
            if not node_id or not new_title:
                return web.json_response({
                    'success': False,
                    'error': '缺少参数'
                }, status=400)
            
            data = self.load_data()
            
            # 查找并更新节点标题
            for fav in data['favorites']:
                if fav.get('id') == node_id:
                    fav['title'] = new_title
                    break
            
            if self.save_data(data):
                return web.json_response({
                    'success': True
                })
            else:
                return web.json_response({
                    'success': False,
                    'error': '保存失败'
                }, status=500)
                
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def delete_category(self, request):
        """删除分类"""
        try:
            category_name = request.query.get('name', '').strip()
            
            if not category_name:
                return web.json_response({
                    'success': False,
                    'error': '分类名称不能为空'
                }, status=400)
            
            if category_name == '默认分类':
                return web.json_response({
                    'success': False,
                    'error': '默认分类不能删除'
                }, status=400)
            
            data = self.load_data()
            
            if category_name in data['categories']:
                # 删除分类
                data['categories'].remove(category_name)
                
                # 将该分类下的所有收藏移动到默认分类
                for fav in data['favorites']:
                    if fav.get('category') == category_name:
                        fav['category'] = '默认分类'
                
                if self.save_data(data):
                    return web.json_response({
                        'success': True
                    })
                else:
                    return web.json_response({
                        'success': False,
                        'error': '保存失败'
                    }, status=500)
            
            return web.json_response({
                'success': False,
                'error': '分类不存在'
            }, status=404)
                
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    def _get_image_metadata_from_base64(self, base64_data):
        """从base64图片数据中提取元数据"""
        try:
            # 移除data URL前缀（如果有）
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            # 解码base64
            image_bytes = base64.b64decode(base64_data)
            image_io = io.BytesIO(image_bytes)
            
            # 使用PIL读取图片
            with Image.open(image_io) as img:
                info = {
                    "width": img.width,
                    "height": img.height,
                    "format": img.format,
                    "mode": img.mode,
                    "aspect_ratio": round(img.width / img.height, 2) if img.height > 0 else 0
                }
                
                # 提取PNG metadata (ComfyUI/A1111等生成的图片)
                if img.format == 'PNG':
                    png_info = img.info
                    
                    # ComfyUI prompt
                    if 'prompt' in png_info:
                        try:
                            comfy_prompt = json.loads(png_info['prompt'])
                            info["comfy_prompt"] = comfy_prompt
                            # 提取ComfyUI中的模型信息
                            model_info = self._extract_comfy_models(comfy_prompt)
                            if model_info:
                                info["comfy_models"] = model_info
                            # 提取提示词信息
                            prompt_info = self._extract_comfy_prompts(comfy_prompt)
                            if prompt_info:
                                info["comfy_prompts"] = prompt_info
                        except:
                            info["comfy_prompt"] = png_info['prompt']
                    
                    # ComfyUI workflow
                    if 'workflow' in png_info:
                        try:
                            workflow = json.loads(png_info['workflow'])
                            info["comfy_workflow"] = workflow
                            # 提取工作流中的节点信息
                            workflow_info = self._extract_workflow_info(workflow)
                            if workflow_info:
                                info["workflow_summary"] = workflow_info
                        except:
                            pass
                    
                    # A1111/Forge parameters
                    if 'parameters' in png_info:
                        info["parameters"] = png_info['parameters']
                        # 解析parameters字符串
                        params_text = png_info['parameters']
                        parsed_params = self._parse_generation_params(params_text)
                        info["parsed_params"] = parsed_params
                        
                        # 提取关键信息到顶层
                        if 'model' in parsed_params:
                            info["ai_model"] = parsed_params['model']
                        if 'vae' in parsed_params:
                            info["ai_vae"] = parsed_params['vae']
                        if 'loras' in parsed_params:
                            info["ai_loras"] = parsed_params['loras']
                        if 'sampler' in parsed_params or 'Sampler' in parsed_params:
                            info["ai_sampler"] = parsed_params.get('sampler', parsed_params.get('Sampler'))
                        if 'steps' in parsed_params:
                            info["ai_steps"] = parsed_params['steps']
                        if 'cfg_scale' in parsed_params:
                            info["ai_cfg"] = parsed_params['cfg_scale']
                        if 'seed' in parsed_params:
                            info["ai_seed"] = parsed_params['seed']
                    
                    # 检查其他可能的元数据字段
                    for key in png_info.keys():
                        if key.lower() in ['software', 'generator', 'creation time', 'author']:
                            info[f"meta_{key.lower().replace(' ', '_')}"] = png_info[key]
                
                # 尝试提取JPEG的EXIF信息
                elif img.format in ['JPEG', 'JPG']:
                    try:
                        from PIL.ExifTags import TAGS
                        exif = img._getexif()
                        if exif:
                            exif_info = {}
                            for tag_id, value in exif.items():
                                tag = TAGS.get(tag_id, tag_id)
                                # 只提取可序列化的基本信息
                                if isinstance(value, (str, int, float, bool)):
                                    exif_info[tag] = value
                                elif isinstance(value, bytes):
                                    try:
                                        exif_info[tag] = value.decode('utf-8', errors='ignore')[:100]
                                    except:
                                        pass
                            
                            if exif_info:
                                info["exif_info"] = exif_info
                                # 提取常用信息
                                if 'Software' in exif_info:
                                    info["meta_software"] = exif_info['Software']
                                if 'ImageDescription' in exif_info:
                                    info["meta_description"] = exif_info['ImageDescription']
                    except Exception as e:
                        print(f"[Chick] Error reading EXIF: {e}")
                
                return info
        except Exception as e:
            print(f"[Chick] Error getting image metadata: {e}")
            return {}
    
    def _extract_comfy_models(self, comfy_prompt):
        """从ComfyUI prompt中提取模型信息"""
        try:
            models = {}
            
            if isinstance(comfy_prompt, dict):
                for node_id, node_data in comfy_prompt.items():
                    if isinstance(node_data, dict) and 'inputs' in node_data:
                        inputs = node_data['inputs']
                        class_type = node_data.get('class_type', '')
                        
                        # 传统CheckpointLoader节点
                        if 'ckpt_name' in inputs:
                            models['checkpoint'] = inputs['ckpt_name']
                        
                        # 新式UNET加载器节点
                        elif class_type == 'UNETLoader' and 'unet_name' in inputs:
                            models['unet_model'] = inputs['unet_name']
                        
                        # CLIP加载器节点
                        elif class_type == 'CLIPLoader' and 'clip_name' in inputs:
                            models['clip_model'] = inputs['clip_name']
                        
                        # 双CLIP加载器
                        elif class_type == 'DualCLIPLoader':
                            if 'clip_name1' in inputs:
                                models['clip_model_1'] = inputs['clip_name1']
                            if 'clip_name2' in inputs:
                                models['clip_model_2'] = inputs['clip_name2']
                        
                        # VAE加载器
                        elif 'vae_name' in inputs:
                            models['vae'] = inputs['vae_name']
                        
                        # Lora加载器
                        elif 'lora_name' in inputs:
                            if 'loras' not in models:
                                models['loras'] = []
                            lora_info = {
                                'name': inputs['lora_name'],
                                'strength_model': inputs.get('strength_model', 1.0),
                                'strength_clip': inputs.get('strength_clip', 1.0)
                            }
                            models['loras'].append(lora_info)
                        
                        # ControlNet加载器
                        elif 'control_net_name' in inputs:
                            if 'controlnets' not in models:
                                models['controlnets'] = []
                            models['controlnets'].append(inputs['control_net_name'])
            
            return models
        except Exception as e:
            print(f"[Chick] Error extracting ComfyUI models: {e}")
            return {}
    
    def _extract_comfy_prompts(self, comfy_prompt):
        """从ComfyUI prompt中提取所有文本节点的文本信息"""
        try:
            prompts = {}
            text_nodes = {}  # 存储所有文本节点
            
            # 模型相关的字段名，需要排除
            model_field_names = [
                'ckpt_name', 'unet_name', 'clip_name', 'clip_name1', 'clip_name2',
                'vae_name', 'lora_name', 'control_net_name', 'model_name',
                'checkpoint_name', 'model', 'vae', 'lora', 'controlnet'
            ]
            
            # 模型加载器节点类型，需要排除
            model_loader_types = [
                'CheckpointLoader', 'CheckpointLoaderSimple', 'UNETLoader',
                'CLIPLoader', 'DualCLIPLoader', 'VAELoader', 'LoraLoader',
                'ControlNetLoader', 'ControlNetLoaderAdvanced'
            ]
            
            # 模型文件扩展名，需要排除
            model_extensions = ['.safetensors', '.ckpt', '.pt', '.pth', '.bin']
            
            # 数值类型字段，需要排除
            numeric_fields = ['seed', 'steps', 'cfg', 'cfg_scale', 'width', 'height', 
                            'batch_size', 'start_at_step', 'end_at_step', 'return_with_leftover_noise',
                            'noise_seed', 'strength', 'weight', 'multiplier', 'scale', 'factor']
            
            def is_model_file(text):
                """检查是否是模型文件名"""
                if not text:
                    return False
                text_lower = text.lower()
                return any(text_lower.endswith(ext) for ext in model_extensions)
            
            def is_model_field(key, class_type):
                """检查是否是模型相关字段"""
                key_lower = key.lower()
                # 检查字段名
                if any(model_field in key_lower for model_field in model_field_names):
                    return True
                # 检查节点类型
                if any(loader_type in class_type for loader_type in model_loader_types):
                    return True
                return False
            
            def is_numeric_field(key, value):
                """检查是否是数值字段"""
                key_lower = key.lower()
                if key_lower in numeric_fields:
                    return True
                # 尝试转换为数字
                try:
                    float(value)
                    return True
                except:
                    pass
                return False
            
            def should_extract_text(key, value, class_type):
                """判断是否应该提取这个文本"""
                if not isinstance(value, str):
                    return False
                
                text = value.strip()
                if not text:
                    return False
                
                # 排除模型相关字段
                if is_model_field(key, class_type):
                    return False
                
                # 排除模型文件名
                if is_model_file(text):
                    return False
                
                # 排除数值字段
                if is_numeric_field(key, text):
                    return False
                
                # 排除很短的文本（可能是ID或标识符）
                if len(text) < 3:
                    return False
                
                # 排除明显是路径的文本（以/或\开头）
                if text.startswith('/') or text.startswith('\\'):
                    return False
                
                # 排除看起来像文件路径的文本
                if '\\' in text or ('/' in text and '.' in text.split('/')[-1]):
                    # 可能是文件路径，检查是否以常见扩展名结尾
                    path_lower = text.lower()
                    if any(path_lower.endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.json', '.txt', '.csv']):
                        return False
                
                return True
            
            if isinstance(comfy_prompt, dict):
                for node_id, node_data in comfy_prompt.items():
                    if isinstance(node_data, dict) and 'inputs' in node_data:
                        inputs = node_data['inputs']
                        class_type = node_data.get('class_type', '')
                        
                        # 跳过模型加载器节点
                        if any(loader_type in class_type for loader_type in model_loader_types):
                            continue
                        
                        # 收集该节点的所有文本字段
                        node_texts = []
                        
                        for key, value in inputs.items():
                            if should_extract_text(key, value, class_type):
                                text_content = value.strip()
                                node_texts.append({
                                    'field': key,
                                    'text': text_content
                                })
                        
                        # 如果有文本字段，添加到结果中
                        if node_texts:
                            # 如果只有一个文本字段，直接使用
                            if len(node_texts) == 1:
                                text_item = node_texts[0]
                                prompts[f'{class_type}_{text_item["field"]}_{node_id}'] = {
                                    'text': text_item['text'],
                                    'type': class_type,
                                    'field': text_item['field'],
                                    'node_id': node_id
                                }
                            else:
                                # 多个文本字段，分别添加
                                for text_item in node_texts:
                                    prompts[f'{class_type}_{text_item["field"]}_{node_id}'] = {
                                        'text': text_item['text'],
                                        'type': class_type,
                                        'field': text_item['field'],
                                        'node_id': node_id
                                    }
            
            return prompts
        except Exception as e:
            print(f"[Chick] Error extracting ComfyUI prompts: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def _extract_workflow_info(self, workflow):
        """从工作流中提取关键信息"""
        try:
            info = {
                'nodes_count': len(workflow.get('nodes', [])),
                'node_types': {},
                'has_controlnet': False,
                'has_lora': False,
                'has_upscaler': False
            }
            
            nodes = workflow.get('nodes', [])
            for node in nodes:
                node_type = node.get('type', 'unknown')
                info['node_types'][node_type] = info['node_types'].get(node_type, 0) + 1
                
                # 检查特殊节点类型
                if 'controlnet' in node_type.lower():
                    info['has_controlnet'] = True
                elif 'lora' in node_type.lower():
                    info['has_lora'] = True
                elif any(upscale in node_type.lower() for upscale in ['upscale', 'esrgan', 'realesrgan']):
                    info['has_upscaler'] = True
            
            return info
        except Exception as e:
            print(f"[Chick] Error extracting workflow info: {e}")
            return {}
    
    def _parse_generation_params(self, params_text):
        """解析生成参数文本（A1111/Forge/SD格式）"""
        try:
            params = {}
            lines = params_text.split('\n')
            
            # 第一行通常是正面提示词
            if lines:
                params['prompt'] = lines[0].strip()
            
            # 查找负面提示词
            if 'Negative prompt:' in params_text:
                neg_start = params_text.find('Negative prompt:') + len('Negative prompt:')
                neg_text = params_text[neg_start:]
                neg_end = len(neg_text)
                for i, char in enumerate(neg_text):
                    if char == '\n':
                        next_line_start = i + 1
                        if next_line_start < len(neg_text):
                            next_line = neg_text[next_line_start:].strip()
                            if any(key in next_line for key in ['Steps:', 'Sampler:', 'CFG', 'Seed:', 'Size:', 'Model:', 'VAE:', 'Lora:']):
                                neg_end = i
                                break
                params['negative_prompt'] = neg_text[:neg_end].strip()
            
            # 解析参数行
            param_lines = []
            for line in lines:
                line = line.strip()
                if line.startswith('Negative prompt:') or line == params.get('prompt', ''):
                    continue
                if ':' in line and (',' in line or any(key in line for key in ['Steps:', 'Sampler:', 'CFG', 'Seed:', 'Size:', 'Model:', 'VAE:', 'Lora:', 'Version:'])):
                    param_lines.append(line)
            
            # 解析所有参数行
            for line in param_lines:
                if '<lora:' in line or '<lyco:' in line:
                    loras = self._extract_loras(line)
                    if loras:
                        params['loras'] = loras
                
                parts = line.split(',')
                for part in parts:
                    part = part.strip()
                    if ':' in part:
                        key, value = part.split(':', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        if key.lower() in ['model', 'model hash', 'model name']:
                            params['model'] = value
                        elif key.lower() in ['vae', 'vae hash']:
                            params['vae'] = value
                        elif key.lower() in ['version', 'app version']:
                            params['app_version'] = value
                        elif key.lower() in ['clip skip']:
                            params['clip_skip'] = value
                        elif key.lower() in ['ensd', 'eta noise seed delta']:
                            params['ensd'] = value
                        else:
                            params[key] = value
            
            # 提取尺寸信息
            if 'Size' in params:
                size_str = params['Size']
                if 'x' in size_str:
                    try:
                        width, height = size_str.split('x')
                        params['width'] = int(width.strip())
                        params['height'] = int(height.strip())
                    except:
                        pass
            
            # 提取种子信息
            if 'Seed' in params:
                try:
                    params['seed'] = int(params['Seed'])
                except:
                    pass
            
            # 提取步数信息
            if 'Steps' in params:
                try:
                    params['steps'] = int(params['Steps'])
                except:
                    pass
            
            # 提取CFG信息
            if 'CFG scale' in params:
                try:
                    params['cfg_scale'] = float(params['CFG scale'])
                except:
                    pass
            
            return params
        except Exception as e:
            print(f"[Chick] Error parsing params: {e}")
            return {}
    
    def _extract_loras(self, text):
        """提取Lora信息"""
        try:
            import re
            loras = []
            
            # 匹配 <lora:name:weight> 或 <lyco:name:weight> 格式
            lora_pattern = r'<(lora|lyco):([^:>]+):([^>]+)>'
            matches = re.findall(lora_pattern, text)
            
            for match in matches:
                lora_type, name, weight = match
                try:
                    weight = float(weight)
                except:
                    weight = weight.strip()
                
                loras.append({
                    'type': lora_type,
                    'name': name.strip(),
                    'weight': weight
                })
            
            return loras
        except Exception as e:
            print(f"[Chick] Error extracting loras: {e}")
            return []
    
    async def get_image_metadata(self, request):
        """获取图片元数据（从base64数据）"""
        try:
            body = await request.json()
            base64_data = body.get('image_data', '')
            
            if not base64_data:
                return web.json_response({
                    'success': False,
                    'error': '缺少图片数据'
                }, status=400)
            
            metadata = self._get_image_metadata_from_base64(base64_data)
            
            return web.json_response({
                'success': True,
                'data': metadata
            })
            
        except Exception as e:
            print(f"[Chick] Error getting image metadata: {e}")
            import traceback
            traceback.print_exc()
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def get_config(self, request):
        """获取配置"""
        try:
            config = self.load_config()
            return web.json_response({
                'success': True,
                'data': config
            })
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def save_config(self, request):
        """保存配置"""
        try:
            body = await request.json()
            config = self.load_config()
            config.update(body)
            
            if self.save_config(config):
                return web.json_response({
                    'success': True,
                    'data': config
                })
            else:
                return web.json_response({
                    'success': False,
                    'error': '保存配置失败'
                }, status=500)
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def save_images_to_storage(self, request):
        """保存图片到文件系统"""
        try:
            body = await request.json()
            images = body.get('images', [])
            storage_dir = self.storage_dir
            storage_dir.mkdir(parents=True, exist_ok=True)
            
            # 读取旧的索引文件，获取所有旧文件的路径
            index_file = storage_dir / 'images_index.json'
            old_file_paths = set()
            if index_file.exists():
                try:
                    with open(index_file, 'r', encoding='utf-8') as f:
                        old_index_data = json.load(f)
                        for img_info in old_index_data.get('images', []):
                            file_path = img_info.get('file_path', '')
                            if file_path:
                                old_file_paths.add(Path(file_path))
                except Exception as e:
                    print(f"[Chick] 读取旧索引文件失败: {e}")
            
            saved_images = []
            failed_count = 0
            new_file_paths = set()  # 记录新保存的文件路径
            
            for img_data in images:
                try:
                    # 从base64解码图片
                    if ',' in img_data.get('dataUrl', ''):
                        base64_data = img_data['dataUrl'].split(',')[1]
                    else:
                        base64_data = img_data.get('dataUrl', '')
                    
                    image_bytes = base64.b64decode(base64_data)
                    
                    # 生成文件名
                    img_id = img_data.get('id', str(int(time.time() * 1000)))
                    file_name = img_data.get('name', f'chick_{img_id}.png')
                    # 确保文件名安全
                    file_name = "".join(c for c in file_name if c.isalnum() or c in (' ', '-', '_', '.')).strip()
                    if not file_name:
                        file_name = f'chick_{img_id}.png'
                    
                    file_path = storage_dir / file_name
                    
                    # 如果文件已存在，添加序号
                    counter = 1
                    original_path = file_path
                    while file_path.exists():
                        name_parts = original_path.stem, original_path.suffix
                        file_path = storage_dir / f"{name_parts[0]}_{counter}{name_parts[1]}"
                        counter += 1
                    
                    # 保存图片
                    with open(file_path, 'wb') as f:
                        f.write(image_bytes)
                    
                    # 记录新文件路径
                    new_file_paths.add(file_path)
                    
                    # 保存图片信息到JSON
                    img_info = {
                        'id': img_id,
                        'name': file_name,
                        'file_path': str(file_path),
                        'size': img_data.get('size', len(image_bytes)),
                        'timestamp': img_data.get('timestamp', time.time())
                    }
                    saved_images.append(img_info)
                    
                except Exception as e:
                    print(f"[Chick] 保存图片失败: {e}")
                    failed_count += 1
            
            # 清理不再需要的旧文件（删除操作）
            deleted_count = 0
            files_to_delete = old_file_paths - new_file_paths
            for file_path in files_to_delete:
                try:
                    if file_path.exists() and file_path.is_file():
                        file_path.unlink()
                        deleted_count += 1
                        print(f"[Chick] 已删除旧文件: {file_path.name}")
                except Exception as e:
                    print(f"[Chick] 删除旧文件失败 {file_path}: {e}")
            
            # 保存图片列表索引
            index_data = {
                'images': saved_images,
                'updated_at': time.time()
            }
            with open(index_file, 'w', encoding='utf-8') as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)
            
            if deleted_count > 0:
                print(f"[Chick] 已清理 {deleted_count} 个不再需要的文件")
            
            return web.json_response({
                'success': True,
                'data': {
                    'saved_count': len(saved_images),
                    'failed_count': failed_count,
                    'deleted_count': deleted_count,
                    'storage_dir': str(storage_dir)
                }
            })
            
        except Exception as e:
            print(f"[Chick] 保存图片到存储失败: {e}")
            import traceback
            traceback.print_exc()
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def load_images_from_storage(self, request):
        """从文件系统加载图片"""
        try:
            storage_dir = self.storage_dir
            index_file = storage_dir / 'images_index.json'
            
            if not index_file.exists():
                return web.json_response({
                    'success': True,
                    'data': []
                })
            
            with open(index_file, 'r', encoding='utf-8') as f:
                index_data = json.load(f)
            
            images = []
            for img_info in index_data.get('images', []):
                file_path = Path(img_info.get('file_path', ''))
                if file_path.exists():
                    try:
                        # 读取图片并转换为base64
                        with open(file_path, 'rb') as f:
                            image_bytes = f.read()
                            base64_data = base64.b64encode(image_bytes).decode('utf-8')
                            # 检测图片格式
                            img_format = 'png'
                            if file_path.suffix.lower() in ['.jpg', '.jpeg']:
                                img_format = 'jpeg'
                            elif file_path.suffix.lower() == '.webp':
                                img_format = 'webp'
                            
                            data_url = f'data:image/{img_format};base64,{base64_data}'
                            
                            images.append({
                                'id': img_info.get('id'),
                                'name': img_info.get('name', file_path.name),
                                'dataUrl': data_url,
                                'size': img_info.get('size', len(image_bytes)),
                                'timestamp': img_info.get('timestamp', file_path.stat().st_mtime)
                            })
                    except Exception as e:
                        print(f"[Chick] 加载图片失败 {file_path}: {e}")
                        continue
            
            return web.json_response({
                'success': True,
                'data': images
            })
            
        except Exception as e:
            print(f"[Chick] 从存储加载图片失败: {e}")
            import traceback
            traceback.print_exc()
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)

# 创建全局实例
chick_server = ChickServer()

def add_routes(routes):
    """添加路由（备用方式）"""
    pass
